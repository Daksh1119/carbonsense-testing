"""
single_processor.py
───────────────────
Full receipt processing pipeline:
  1. Text extraction        (text_extractor.py – multi-PSM + preprocessing)
  2. Metadata extraction    – vendor, date, total amount, currency
  3. Line-item parsing      – per-line AND paragraph-block reassembly strategies
  4. Carbon mapping         – fuzzy keyword matching (carbon_mapper.py)
  5. Supabase insert
  6. API response           – all fields populated

Handles two OCR output formats:
  A) One token-per-line  (Tesseract PSM 11/3 – most fragmented output)
  B) Normal single-line receipts (PSM 6/4)
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Dict, List, Optional
from uuid import uuid4

from ml_services.ocr.text_extractor import extract_text
from ml_services.ocr.carbon_mapper import calculate_receipt_carbon, load_carbon_database
from ml_services.ocr.food_assist import apply_food101_assist
from ml_services.common.supabase_client import supabase
from ml_services.common.authz import get_user_department

# PDF support (optional — requires pymupdf)
try:
    from ml_services.ocr.pdf_processor import extract_text_from_pdf as _pdf_extract
    _PDF_SUPPORT = True
except ImportError:
    _PDF_SUPPORT = False


# ─── OCR noise normaliser ─────────────────────────────────────────────────────

_OCR_SUBS = [
    (re.compile(r"@x"),                              "2x"),
    (re.compile(r"\bIx\b"),                          "1x"),  # standalone Ix word
    (re.compile(r"\bI([xX])(?=[A-Z\d])"),           r"1\1"),  # IxGloki → 1xGloki
    (re.compile(r"a&"),                              "à"),
    (re.compile(r"\bChr\b"),                         "CHF"),
    (re.compile(r"\bGBF\b"),                         "CHF"),
    # Pipe/bracket → letter l  (common Tesseract confusion at word boundaries)
    (re.compile(r"\|([a-zA-Z])"),                    r"l\1"),  # |i → li, |e → le
    (re.compile(r"([a-zA-Z])\|"),                    r"\1l"),  # e|  → el
    (re.compile(r"\]([a-zA-Z])"),                    r"l\1"),  # ]e  → le
    (re.compile(r"([a-zA-Z])\]"),                    r"\1l"),  # e]  → el
    (re.compile(r"([a-zA-Z])\|$"),                   r"\1l"),  # end of word
    (re.compile(r"\b0([a-zA-Z])"),                   r"O\1"),  # 0x → Ox (OCR 0/O swap)
    (re.compile(u"[\u2018\u2019\u201a]"),             "'"),     # curly single quotes
    (re.compile(u"[\u201c\u201d\u201e]"),             '"'),     # curly double quotes
]

def _clean(line: str) -> str:
    for pat, rep in _OCR_SUBS:
        line = pat.sub(rep, line)
    return line.strip()


# ─── Currency detection ───────────────────────────────────────────────────────

_CURRENCY_MAP = {
    "CHF": "CHF", "EUR": "EUR", "€": "EUR",
    "USD": "USD", "$": "USD",
    "GBP": "GBP", "£": "GBP",
    "INR": "INR", "₹": "INR",
    "AED": "AED", "SGD": "SGD",
    "AUD": "AUD", "CAD": "CAD",
    "JPY": "JPY", "¥": "JPY",
}

def _detect_currency(text: str) -> str:
    # India-specific bias: if fiscal markers are present, default toward INR.
    # This avoids OCR artefacts like stray '£' from E.&O.E lines causing GBP.
    india_markers = re.search(
        r"\b(gst|cgst|sgst|igst|fssai|rs\.?|rupees?|india|mumbai|delhi|bengaluru|karnataka|maharashtra)\b",
        text,
        re.IGNORECASE,
    )

    counts: dict[str, int] = {}
    for sym, code in _CURRENCY_MAP.items():
        n = len(re.findall(re.escape(sym), text))
        if n:
            counts[code] = counts.get(code, 0) + n

    # Explicit INR textual forms
    rs_count = len(re.findall(r"\bRs\.?\b", text, re.IGNORECASE))
    rupee_count = len(re.findall(r"\bRupees?\b", text, re.IGNORECASE))
    if rs_count or rupee_count:
        counts["INR"] = counts.get("INR", 0) + rs_count + rupee_count

    # If we saw Indian fiscal markers but no decisive symbol, prefer INR.
    if india_markers and counts.get("INR", 0) == 0:
        counts["INR"] = 1

    # If only weak GBP evidence (single stray symbol) appears with India markers,
    # down-weight it as likely OCR punctuation noise.
    if india_markers and counts.get("GBP", 0) == 1 and counts.get("INR", 0) >= 1:
        counts["GBP"] = 0

    return max(counts, key=lambda k: counts[k]) if counts else "INR"


# ─── Vendor extraction ────────────────────────────────────────────────────────

_NON_VENDOR_RE = re.compile(
    r"(receipt|invoice|bill|table|tisch|rech|nr\.|date|umsatz"
    r"|\bbar\b|cashier|server|order|waiter|\bpos\b|terminal|till|\breg\b"
    r"|\bvat\b|\btax\b|www\.|http|\btel\b|\bfax\b|e-mail|@"
    r"|duplicate|copy|gst|fssai|kot\b|parcel)",
    re.IGNORECASE,
)

# Remove stray OCR punctuation from vendor name
_VENDOR_STRIP_RE = re.compile(r"[\[\]\|\\/<>{}()\*#@!^]+")

def _sanitize_vendor(name: str) -> str:
    """Remove stray OCR artefacts and fix common letter substitutions."""
    name = _VENDOR_STRIP_RE.sub("", name)
    name = re.sub(r"\s{2,}", " ", name).strip(" ,-.:;")
    return name

def _extract_vendor(text: str) -> Optional[str]:
    lines = [_clean(l) for l in text.splitlines() if _clean(l)]
    for line in lines[:8]:
        if (
            re.search(r"[A-Za-z]{3,}", line)
            and not re.match(r"^\d", line)
            and not _NON_VENDOR_RE.search(line)
            and len(line) <= 60
        ):
            vendor = _sanitize_vendor(line)
            return vendor if len(vendor) >= 2 else None
    return None


# ─── Date extraction ──────────────────────────────────────────────────────────

_MONTH_NAMES = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4,
    "may": 5, "jun": 6, "jul": 7, "aug": 8,
    "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

_DATE_PATTERNS: List[tuple] = [
    # DD.MM.YYYY or DD,MM,YYYY or DD/MM/YYYY or DD-MM-YYYY (any separator incl comma)
    (re.compile(r"\b(\d{1,2})[.,/\-]\s*(\d{1,2})[.,/\-]\s*(\d{4})\b"), "dmy"),
    # YYYY-MM-DD  (ISO 8601)
    (re.compile(r"\b(\d{4})[./\-](\d{1,2})[./\-](\d{1,2})\b"),         "ymd"),
    # DD MMM YYYY  (e.g. 12 Jan 2024)
    (re.compile(r"\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\b"),         "dmy_alpha"),
    # DD/MM/YY  (2-digit year — common on Indian & UK receipts)
    (re.compile(r"\b(\d{1,2})[./\-](\d{1,2})[./\-](\d{2})\b"),         "dmy_short"),
    # MM/DD/YYYY  (US – tried last)
    (re.compile(r"\b(\d{1,2})/(\d{1,2})/(\d{4})\b"),                   "mdy"),
]

_PARTIAL_DATE_RE = re.compile(r"\b(\d{1,2})[./\-](\d{1,2})[./\-](\d{1,3})\b")
_DATE_CONTEXT_RE = re.compile(r"\b(date|dated|dt|bill|invoice|total|rs|am|pm)\b", re.IGNORECASE)

def _expand_year(y2: int) -> int:
    """Convert 2-digit year to 4-digit: 00-49 → 2000-2049, 50-99 → 1950-1999."""
    return (2000 + y2) if y2 < 50 else (1900 + y2)


def _expand_year_fragment(raw: str) -> Optional[int]:
    """Expand a partially-read OCR year fragment (1-4 digits) into a plausible year."""
    if not raw.isdigit() or len(raw) > 4:
        return None

    if len(raw) == 4:
        year = int(raw)
        return year if 1900 <= year <= 2100 else None

    current_year = datetime.now(timezone.utc).year

    if len(raw) == 3:
        y2 = int(raw[-2:])
        candidates = [1900 + y2, 2000 + y2]
    elif len(raw) == 2:
        return _expand_year(int(raw))
    else:  # len(raw) == 1
        digit = int(raw)
        candidates = [2000 + digit, 2010 + digit, 2020 + digit]

    # Prefer years near present, and avoid far-future artefacts.
    bounded = [y for y in candidates if 1900 <= y <= current_year + 1]
    if not bounded:
        bounded = [y for y in candidates if 1900 <= y <= 2100]
    return min(bounded, key=lambda y: abs(y - current_year)) if bounded else None

# Regex for date-label prefix (e.g. "Date:", "Dt:", "Bill Date:", "Trans Date:")
_DATE_LABEL_RE = re.compile(
    r"(?:date|dated|dt|bill\s*date|invoice\s*date|trans\s*date)\s*(?:[:\-\u2013]\s*)?",
    re.IGNORECASE,
)
# Regulatory/historical date trap: "w.e.f DD/MM/YYYY" — always ignore these
_WEF_RE = re.compile(
    r"w\.?e\.?f\.?\s*\d{1,2}[/\.\-]\d{1,2}[/\.\-]\d{2,4}",
    re.IGNORECASE,
)

_DATE_OCR_CHAR_MAP = str.maketrans({
    "O": "0", "o": "0", "Q": "0", "D": "0",
    "I": "1", "l": "1", "|": "1",
    "S": "5", "s": "5", "B": "8",
})


def _normalize_date_candidate(text: str) -> str:
    """Normalize common OCR confusions in date-like strings."""
    text = text.translate(_DATE_OCR_CHAR_MAP)
    text = re.sub(r"[\u2012\u2013\u2014\u2015]", "-", text)
    text = re.sub(r"[,;]", "/", text)
    text = re.sub(r"\s*([./\-])\s*", r"\1", text)
    return re.sub(r"\s+", " ", text).strip()


def _parse_date_match(m: re.Match, order: str) -> Optional[str]:
    """Parse a (group1, group2, group3) date match into YYYY-MM-DD or None."""
    try:
        a, b, c = m.group(1), m.group(2), m.group(3)
        if order == "dmy":
            d, mo, y = int(a), int(b), int(c)
        elif order == "ymd":
            y, mo, d = int(a), int(b), int(c)
        elif order == "mdy":
            mo, d, y = int(a), int(b), int(c)
        elif order == "dmy_alpha":
            d = int(a)
            mo = _MONTH_NAMES.get(b.lower()[:3], 0)
            y = int(c)
        elif order == "dmy_short":
            d, mo, y = int(a), int(b), _expand_year(int(c))
        elif order == "dmy_partial":
            d, mo = int(a), int(b)
            y = _expand_year_fragment(c)
            if y is None:
                return None
        elif order == "mdy_partial":
            mo, d = int(a), int(b)
            y = _expand_year_fragment(c)
            if y is None:
                return None
        else:
            return None
        if 1 <= d <= 31 and 1 <= mo <= 12 and 1900 <= y <= 2100:
            return f"{y:04d}-{mo:02d}-{d:02d}"
    except (ValueError, TypeError):
        pass
    return None


def _extract_date(text: str) -> Optional[str]:
    """
    Extract the receipt issue date.  Strategy (highest priority first):
    1. Scan for a date immediately after a label like 'Date:', 'Dt:' etc.
    2. Try 2-digit year formats (DD/MM/YY) — common on Indian receipts.
    3. Fall back to full 4-digit-year formats in left-to-right order.
    In all cases, 'w.e.f DD/MM/YYYY' footer markers are stripped first
    because they always carry a regulatory effective date, not receipt date.
    """
    # Strip regulatory date traps before any matching
    clean = _WEF_RE.sub("", text)
    flat = " ".join(clean.splitlines())
    flat_norm = _normalize_date_candidate(flat)

    # ── Priority 1: date adjacent to a label ─────────────────────────────────
    label_m = _DATE_LABEL_RE.search(flat)
    if label_m:
        snippet = flat[label_m.end(): label_m.end() + 30]
        snippet_norm = _normalize_date_candidate(snippet)
        for pat, order in _DATE_PATTERNS:
            for candidate in (snippet_norm, snippet):
                m = pat.search(candidate)
                if not m:
                    continue
                result = _parse_date_match(m, order)
                if result:
                    return result

    # ── Priority 2: 2-digit year (index 3 in _DATE_PATTERNS) ─────────────────
    pat_short, order_short = _DATE_PATTERNS[3]
    for candidate in (flat_norm, flat):
        m = pat_short.search(candidate)
        if not m:
            continue
        result = _parse_date_match(m, order_short)
        if result:
            return result

    # ── Priority 3: remaining patterns in declaration order ───────────────────
    for idx, (pat, order) in enumerate(_DATE_PATTERNS):
        if idx == 3:
            continue   # already tried above
        for candidate in (flat_norm, flat):
            m = pat.search(candidate)
            if not m:
                continue
            result = _parse_date_match(m, order)
            if result:
                return result

    # ── Priority 4: partial OCR-clipped dates in date-like context lines ─────
    # Example: "12/18/2 Total Rs" where the year is partially unreadable.
    for raw_line in clean.splitlines():
        if not _DATE_CONTEXT_RE.search(raw_line):
            continue
        line = _normalize_date_candidate(raw_line)
        m = _PARTIAL_DATE_RE.search(line)
        if not m:
            continue
        for order in ("dmy_partial", "mdy_partial"):
            result = _parse_date_match(m, order)
            if result:
                return result

    return None


# ─── Total amount extraction ──────────────────────────────────────────────────

_TOTAL_LABEL_RE = re.compile(
    r"(?:food\s*total|grand\s*total|amount\s*due|to\s*pay|zu\s*zahlen"
    r"|sum|gesamtbetrag|gesamt|betrag|balance\s*due|net\s*amount"
    # "total" but NOT preceded by "sub" (handles "Sub Total" lines)
    r"|(?<!sub\s)(?<!sub)total[es]*)[^0-9]*"
    r"(\d{1,6}[.,]\s*\d{2})",   # allow space between decimal and cents, e.g. '9. 00'
    re.IGNORECASE,
)
# Subtotal patterns — tried only when no labeled total is found
_SUBTOTAL_LABEL_RE = re.compile(
    r"(?:subtotal|sub\s*total)[^0-9]*(\d{1,6}[.,]\s*\d{2})",
    re.IGNORECASE,
)
# Integer-only totals (Indian/other receipts that omit the decimal point).
# Require the integer to appear within ~20 chars of the label (no chaining across sentences).
# "total" must not be preceded by "sub".
_TOTAL_INT_LABEL_RE = re.compile(
    r"(?:food\s*total|grand\s*total|(?<!sub\s)(?<!sub)total[es]*|amount\s*due)"
    r"\s*[:\-–]?\s*(\d{3,6})\b",
    re.IGNORECASE,
)
_ANY_PRICE_RE = re.compile(r"\b(\d{1,6}[.,]\s*\d{2})\b")

def _to_float(raw: str) -> Optional[float]:
    """Parse a price string to float, handling spaces like '9. 00'."""
    try:
        return float(re.sub(r"\s+", "", raw).replace(",", "."))
    except ValueError:
        return None

def _extract_total(text: str) -> Optional[float]:
    flat = " ".join(text.splitlines())
    # 1. Prefer "food total / grand total / total" with a decimal price
    matches = list(_TOTAL_LABEL_RE.finditer(flat))
    if matches:
        v = _to_float(matches[-1].group(1))
        if v is not None:
            return round(v, 2)
    # 2. Try "total" with an integer amount (Indian receipts: "Total : 1176")
    m = _TOTAL_INT_LABEL_RE.search(flat)
    if m:
        try:
            return float(m.group(1))
        except ValueError:
            pass
    # 3. Try computing from sub-total + GST (Indian receipts where the final
    #    total line is present but its number is missing from the OCR output).
    sub_m = _SUBTOTAL_LABEL_RE.search(flat)
    if sub_m:
        sub = _to_float(sub_m.group(1))
        if sub is not None:
            # Strategy A — sum explicit GST amounts after each "CGST/SGST : <amount>"
            gst_amounts = re.findall(
                r"(?:cgst|sgst|igst)\s*@[\d.]+%?\s+on\s+[\d.]+\s*:\s*(\d+(?:\.\d{2})?)",
                flat, re.IGNORECASE,
            )
            gst_total = sum(float(g) for g in gst_amounts)

            # Strategy B — if OCR dropped some amounts, derive from the GST rates
            if not gst_total:
                rates = re.findall(
                    r"(?:cgst|sgst|igst)\s*@\s*([\d.]+)%",
                    flat, re.IGNORECASE,
                )
                rate_total = sum(float(r) for r in rates)
                if rate_total:
                    gst_total = round(sub * rate_total / 100, 2)

            # Strategy C — if only one of CGST/SGST captured but both present
            # (equal-rate split), double the found amount
            if gst_total and len(gst_amounts) == 1:
                has_cgst = bool(re.search(r"\bcgst\b", flat, re.IGNORECASE))
                has_sgst = bool(re.search(r"\bsgst\b", flat, re.IGNORECASE))
                if has_cgst and has_sgst:
                    gst_total *= 2

            if gst_total > 0:
                return round(sub + gst_total, 2)
    # 4. Fall back to "subtotal" with a decimal price alone
    if sub_m:
        v = _to_float(sub_m.group(1))
        if v is not None:
            return round(v, 2)
    # 5. Last resort: largest decimal price found anywhere
    prices = [_to_float(p) for p in _ANY_PRICE_RE.findall(flat)]
    valid = [p for p in prices if p is not None]
    return round(max(valid), 2) if valid else None


# ─── Line-item parser helpers ─────────────────────────────────────────────────

# Words that, when found as whole tokens in a line, indicate it is NOT an item line.
# Currency codes are intentionally excluded — they are cleaned from names via _CURR_CODE_RE.
_SKIP_WORDS = {
    "total", "totales", "subtotal", "mwst", "tax", "incl", "inkl",
    "tel", "fax", "email", "www", "vat",
    "mehrwertsteuer", "tip", "gratuity", "change", "cash", "card",
    "payment", "paid", "balance", "credit", "debit", "sum", "gesamt",
    "betrag", "service charge", "rounding", "discount", "coupon",
    "entspricht", "bediente", "mwst nr", "bar", "tisch",
    # Receipt header words
    "rech", "nr", "rechnung", "beleg", "quittung",
    # Additional non-item lines (loyalty, fuel pump headers, void transactions)
    "loyalty", "reward", "points", "void", "refund", "adjustment",
    "surcharge", "convenience fee", "delivery fee", "packing charge",
    "fuel", "pump", "litres", "liters", "price/litre", "price/liter",
    "authorized", "approved", "declined", "transaction",
    # India receipt fiscal/compliance lines (never line items)
    "gst", "cgst", "sgst", "igst", "fssai", "hsn", "sac",
    "round off", "rnd", "e&o.e", "eod", "tax invoice",
    "bill no", "table no", "emp no", "mob", "phone",
}

# Compile a word-boundary pattern for skip words (avoids false positives like
# skipping "Taxi" because it contains "tax").
_SKIP_PATTERN = re.compile(
    r"\b(?:" + "|".join(re.escape(w) for w in _SKIP_WORDS) + r")\b",
    re.IGNORECASE,
)

# Standalone currency-code-only paragraph (e.g. a line reading just "CHF")
_STANDALONE_CURR_RE = re.compile(
    r"^\s*(CHF|EUR|USD|GBP|INR|AED|SGD|AUD|CAD|JPY)\s*$", re.IGNORECASE
)
# Prices may have an embedded space like "9. 00" from fragmented PSM output
_ITEM_PRICE_RE  = re.compile(r"(\d{1,6}[.,]\s*\d{2})\b")
# Integer-only price (e.g. "310", "255") — used as fallback when no decimal found.
# Must be at least 2 digits to avoid matching qty/rate columns spuriously.
_ITEM_PRICE_INT_RE = re.compile(r"\b(\d{2,6})\b")
_WORD_RE        = re.compile(r"[A-Za-z]{3,}")
_QTY_PREFIX_RE  = re.compile(r"^\d+\s*[xX×]\s*")
_QTY_LINE_RE    = re.compile(r"^(\d+)\s*[xX×]\s*(.+)$")   # e.g. "2xLatte Macchiato"
_CURR_CODE_RE   = re.compile(
    r"\b(CHF|EUR|USD|GBP|INR|AED|SGD|AUD|CAD|JPY)\b", re.IGNORECASE
)
# Indian receipt format: "ITEM NAME   qty   rate   amount"  (4 columns)
# or collapsed OCR:      "ITEM NAME   qty   amount"          (3 columns, rate omitted)
# The last integer is always the line total.
_INDIAN_ITEM_RE = re.compile(
    r"^(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s*$"   # 4-col: name qty rate amount
)
_INDIAN_ITEM_RE3 = re.compile(
    r"^(.+?)\s+(\d+)\s+(\d+)\s*$"            # 3-col: name qty amount  (OCR collapsed)
)

_NON_ITEM_PREFIX_RE = re.compile(
    r"^(?:"
    r"sub\s*total|food\s*total|grand\s*total|total|tax|cgst|sgst|igst|gst|"
    r"fssai|gst\s*no|hsn|sac|rnd\s*amt|round\s*off|bill\s*no|table\s*no|"
    r"emp\s*no|date|time|mob|phone|e\.?\s*&\s*o\.?\s*e\.?"
    r")\b",
    re.IGNORECASE,
)

# ─── OCR spelling corrections ─────────────────────────────────────────────────
# Pairs of (ocr_garbled_pattern, corrected_text).  Applied to item names before
# display and carbon matching.  This repairs the most common Tesseract misreads
# on Indian restaurant receipts printed in all-caps.
_OCR_CORRECTIONS: List[tuple] = [
    # Specific OCR misread variants seen on real receipts
    (re.compile(r"\bKHICHADT\b", re.I),    "KHICHADI"),
    (re.compile(r"\bKHICHARI\b", re.I),    "KHICHADI"),
    (re.compile(r"\bKHICHRI\b",  re.I),    "KHICHDI"),
    (re.compile(r"\bMANCHURTAN\b", re.I),  "MANCHURIAN"),
    (re.compile(r"\bMANCHURIAN\b", re.I),  "MANCHURIAN"),   # normalise casing
    (re.compile(r"\bCHILLY\b",   re.I),    "CHILLI"),       # UK/Indian spelling
    (re.compile(r"\bTADKEWALI\b", re.I),   "TADKA WALI"),   # split compound
    (re.compile(r"\bVEG\.?\b",   re.I),    "VEG"),          # strip errant period
    (re.compile(r"\bSPL\.?\b",   re.I),    "SPECIAL"),      # "SPL" abbreviation
    (re.compile(r"\bMSLA\b",     re.I),    "MASALA"),       # truncated
    (re.compile(r"\bPNR\b",      re.I),    "PANEER"),       # truncated
    (re.compile(r"\bCHKN\b",     re.I),    "CHICKEN"),      # abbreviated
    (re.compile(r"\bMTN\b",      re.I),    "MUTTON"),       # abbreviated
    # Common OCR noise on caps-printed receipts
    (re.compile(r"\bJAX\b",      re.I),    ""),             # stray token
    (re.compile(r"\bINVOICE\b",  re.I),    ""),             # stray "Jax Invoice" header
]


def _correct_ocr(name: str) -> str:
    """Apply receipt-domain OCR spelling corrections to an item name."""
    for pat, replacement in _OCR_CORRECTIONS:
        name = pat.sub(replacement, name)
    return re.sub(r"\s{2,}", " ", name).strip()


def _build_item_name(line: str) -> str:
    """Strip prices, currency codes, quantities, and punctuation from a line."""
    name = _ITEM_PRICE_RE.sub("", line)
    name = _CURR_CODE_RE.sub("", name)
    name = re.sub(r"[€£₹¥$]", "", name)
    name = _QTY_PREFIX_RE.sub("", name)
    name = re.sub(r"\b\d+\b", "", name)
    name = name.replace("à", " ").replace("ä", "a") \
               .replace("ö", "o").replace("ü", "u")
    name = re.sub(r"\s{2,}", " ", name).strip(" ,-.:@/()|[]")
    return _correct_ocr(name)


# ─── Strategy A: per-line parsing (clear receipts) ───────────────────────────

def _parse_items_per_line(text: str) -> List[Dict]:
    """
    Standard parsing: each item line contains both a word and a price.

    Handles two price formats:
      A) Decimal:  "Latte Macchiato       4.50"
      B) Integer:  "CHEESE CHILLY TOAST   1   310   310"   (Indian: qty rate amount)
    """
    items: List[Dict] = []
    for raw_line in text.splitlines():
        line = _clean(raw_line)
        if not line:
            continue
        # Skip GST-like tax lines even when OCR mutates letters (e.g. CGST -> CEST).
        if re.search(r"\b(?:cgst|sgst|igst|gst|cest)\b", line, re.IGNORECASE):
            continue
        if re.search(r"\bon\s+\d+(?:[.,]\d+)?\s*:\s*\d+(?:[.,]\d+)?", line, re.IGNORECASE):
            continue
        # Skip lines with very long identifier-like numbers (e.g. FSSAI/GST IDs).
        if re.search(r"\b\d{8,}\b", line):
            continue
        if _NON_ITEM_PREFIX_RE.search(line):
            continue
        if _SKIP_PATTERN.search(line):
            continue
        # Skip discount/adjustment lines: any line whose amount is negative
        # e.g. "MEMBER DISC  -4.50"  or  "PROMO SAVE  -50"
        if re.search(r"[-\u2212]\s*\d{1,6}(?:[.,]\d{2})?\b", line):
            continue
        if not _WORD_RE.search(line):
            continue

        # ── Format A: line contains a decimal/comma price ──────────────────
        decimal_prices = _ITEM_PRICE_RE.findall(line)
        if decimal_prices:
            amount = _to_float(decimal_prices[-1]) or 0.0
            qty_match = _QTY_LINE_RE.match(line)
            quantity = int(qty_match.group(1)) if qty_match else 1
            name = _build_item_name(line)
            if len(name) < 3:
                continue
            items.append({"name": name, "amount": round(amount, 2), "quantity": quantity})
            continue

        # ── Format B: Indian receipt "NAME  qty  rate  amount" (all integers) ──
        # Try 4-column first (qty, rate, amount all present), then 3-column
        # (OCR sometimes collapses duplicate amount columns).
        indian_m  = _INDIAN_ITEM_RE.match(line)
        indian_m3 = _INDIAN_ITEM_RE3.match(line) if not indian_m else None
        if indian_m or indian_m3:
            m = indian_m or indian_m3
            raw_name = m.group(1).strip()
            # Skip header/metadata lines that slipped through _SKIP_PATTERN
            if re.match(r"^(particulars|item|description|s\.?\s*no)", raw_name, re.I):
                continue
            if _NON_ITEM_PREFIX_RE.search(raw_name):
                continue
            if indian_m:
                quantity = int(indian_m.group(2))
                amount   = int(indian_m.group(4))   # last column = line total
            else:
                # 3-col: group(2)=qty, group(3)=could be rate OR total.
                # When qty > 1 the OCR dropped the duplicate amount column,
                # so group(3) is the *rate* — multiply to get the line total.
                quantity = int(indian_m3.group(2))
                col3     = int(indian_m3.group(3))
                amount   = col3 * quantity if quantity > 1 else col3
            name = _build_item_name(raw_name)
            if len(name) < 3:
                continue
            items.append({"name": name, "amount": float(amount), "quantity": quantity})

    return items


# ─── Strategy B: paragraph-block reassembly (fragmented PSM output) ──────────

def _parse_items_fragmented(text: str) -> List[Dict]:
    """
    Handles Tesseract output where each token is on its own line.
    Groups into blocks separated by blank lines, then identifies item blocks
    (starting with 1x/2x/… patterns) and collects associated price lines.

    Example paragraph sequence:
        "2xLatte Macchiato" → "a" → "4,50" → "CHF" → "9.00"
        "1xSchweinschnitzel" → "a" → "22.00" → "CHF" → "22.00"
    """
    # Split on one-or-more blank lines to get paragraphs
    paragraphs = [_clean(p) for p in re.split(r"\n{2,}", text) if _clean(p)]

    items: List[Dict] = []
    current_name: Optional[str] = None
    collected_prices: List[float] = []

    def _flush():
        nonlocal current_name, collected_prices
        if current_name and collected_prices:
            items.append({
                "name": current_name,
                "amount": round(collected_prices[-1], 2),
            })
        current_name = None
        collected_prices = []

    for para in paragraphs:
        # Standalone currency code (e.g. paragraph is just "CHF") — skip without flushing
        if _STANDALONE_CURR_RE.match(para):
            continue

        # Is this a "stop" line (totals, headers)?
        if _SKIP_PATTERN.search(para):
            _flush()
            continue

        # Is this an item name line? Pattern: optional_qty + alpha text
        qty_m = _QTY_LINE_RE.match(para)
        has_alpha_content = bool(_WORD_RE.search(para)) and not _ITEM_PRICE_RE.search(para)

        if qty_m or (has_alpha_content and len(para) >= 3):
            _flush()
            # Build name from the paragraph
            raw_name = qty_m.group(2) if qty_m else para
            name = _build_item_name(_clean(raw_name))
            current_name = name if len(name) >= 3 else None
            continue

        # Is this a price line?
        if current_name:
            price_clean = re.sub(r"\s+", "", para)       # handle "9. 00"
            price_m = re.search(r"(\d{1,6}[.,]\d{2})", price_clean)
            if price_m:
                val = _to_float(price_m.group(1))
                if val is not None:
                    collected_prices.append(val)

    _flush()
    return items


# ─── Public item parser: tries Strategy A, falls back to B ───────────────────

def _parse_items(text: str) -> List[Dict]:
    """
    Attempt per-line parsing first.  If it yields no items AND the text looks
    fragmented (most lines have < 3 tokens), use the paragraph-block strategy.
    """
    items = _parse_items_per_line(text)
    if items:
        return items

    # Detect fragmentation: more than half of non-empty lines are very short
    non_empty = [l for l in text.splitlines() if l.strip()]
    short = sum(1 for l in non_empty if len(l.split()) <= 2)
    if non_empty and (short / len(non_empty)) > 0.4:
        items = _parse_items_fragmented(text)

    return items


# ─── Public entry point ───────────────────────────────────────────────────────

def process_single_receipt(
    file_path: str,
    file_name: str,
    organization_id: str,
    uploaded_by_user_id: str,
    employee_user_id: Optional[str] = None,
) -> Dict:
    receipt_id = str(uuid4())

    # Route PDF files through the pdf_processor; images through text_extractor
    is_pdf = file_path.lower().endswith(".pdf")
    if is_pdf:
        if _PDF_SUPPORT:
            extraction = _pdf_extract(file_path)
        else:
            extraction = {
                "text": "",
                "method": "pdf-ocr",
                "success": False,
                "confidence": 0.0,
                "error": "PDF support not installed (pip install pymupdf)",
            }
    else:
        extraction = extract_text(file_path)

    raw_text    = extraction.get("text", "")
    confidence  = extraction.get("confidence", 0.0)

    items         = _parse_items(raw_text)
    carbon_db     = load_carbon_database()
    carbon_result = calculate_receipt_carbon(items, carbon_db)

    # Optional, conservative Food101-assisted fallback for low-confidence OCR.
    # Disabled by default and only changes unknown/empty mappings when confident.
    food_assist = apply_food101_assist(
        file_path=file_path,
        is_pdf=is_pdf,
        ocr_confidence=confidence,
        mapped_items=carbon_result.get("mapped_items", []),
    )
    carbon_result["mapped_items"] = food_assist["mapped_items"]
    carbon_result["total_carbon_kg"] = food_assist["total_carbon_kg"]

    vendor       = _extract_vendor(raw_text)
    receipt_date = _extract_date(raw_text)
    total_amount = _extract_total(raw_text)
    currency     = _detect_currency(raw_text)

    employee_department = "unassigned"
    if employee_user_id:
        employee_department = get_user_department(employee_user_id, organization_id)

    # DB row – matches receipts_ocr_results schema columns
    row = {
        "receipt_id":          receipt_id,
        "organization_id":     organization_id,
        "uploaded_by":         uploaded_by_user_id,
        "employee_user_id":    employee_user_id,
        "employee_department": employee_department,
        "source_file_name":    file_name,
        "ocr_text":            raw_text,
        "ocr_method":          extraction.get("method", "tesseract"),
        "vendor":              vendor,
        "receipt_date":        receipt_date,
        "total_amount":        total_amount,
        "currency":            currency,
        "ocr_confidence":      round(confidence, 4),
        "carbon_total_kg":     carbon_result["total_carbon_kg"],
        "mapped_items":        carbon_result["mapped_items"],
        "status":              "processed",
        "processed_at":        datetime.utcnow().isoformat(),
    }

    supabase.table("receipts_ocr_results").insert(row).execute()

    # API response (superset of DB row)
    line_items = [
        {
            "description": item.get("name"),
            "amount":      item.get("amount", 0.0),
            "category":    item.get("category"),
            "carbon_kg":   item.get("carbon_kg"),
        }
        for item in carbon_result["mapped_items"]
    ]

    warnings: List[str] = []
    if not extraction.get("success"):
        warnings.append(extraction.get("error", "OCR extraction failed"))
    if confidence < 0.5:
        warnings.append("Low OCR confidence – manual review recommended")
    if food_assist["assist"].get("triggered") and not food_assist["assist"].get("applied"):
        warnings.append("Food model assist triggered but not applied")
    if food_assist["assist"].get("applied"):
        warnings.append("Food model assist applied to unknown OCR item mapping")

    return {
        **row,
        "success":         True,
        "vendor":          vendor,
        "receipt_date":    receipt_date,
        "total_amount":    total_amount,
        "currency":        currency,
        "confidence":      confidence,
        "requires_review": confidence < 0.7,
        "raw_text":        raw_text,
        "line_items":      line_items,
        "carbon_analysis": {
            "total_carbon_kg": row["carbon_total_kg"],
            "mapped_items":    row["mapped_items"],
        },
        "food_model_assist": food_assist["assist"],
        "warnings": warnings,
    }
