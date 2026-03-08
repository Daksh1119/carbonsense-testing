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
from datetime import datetime
from typing import Dict, List, Optional
from uuid import uuid4

from ml_services.ocr.text_extractor import extract_text
from ml_services.ocr.carbon_mapper import calculate_receipt_carbon, load_carbon_database
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
    counts: dict[str, int] = {}
    for sym, code in _CURRENCY_MAP.items():
        n = len(re.findall(re.escape(sym), text))
        if n:
            counts[code] = counts.get(code, 0) + n
    return max(counts, key=lambda k: counts[k]) if counts else "INR"


# ─── Vendor extraction ────────────────────────────────────────────────────────

_NON_VENDOR_RE = re.compile(
    r"(receipt|invoice|bill|table|tisch|rech|nr\.|date|umsatz"
    r"|\bbar\b|cashier|server|order|waiter|\bpos\b|terminal|till|\breg\b"
    r"|\bvat\b|\btax\b|www\.|http|\btel\b|\bfax\b|e-mail|@)",
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
    # MM/DD/YYYY  (US – tried last)
    (re.compile(r"\b(\d{1,2})/(\d{1,2})/(\d{4})\b"),                   "mdy"),
]

def _extract_date(text: str) -> Optional[str]:
    # Also try with newlines collapsed
    flat = " ".join(text.splitlines())
    for pat, order in _DATE_PATTERNS:
        m = pat.search(flat)
        if not m:
            continue
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
            else:
                continue
            if 1 <= d <= 31 and 1 <= mo <= 12 and 1900 <= y <= 2100:
                return f"{y:04d}-{mo:02d}-{d:02d}"
        except (ValueError, TypeError):
            continue
    return None


# ─── Total amount extraction ──────────────────────────────────────────────────

_TOTAL_LABEL_RE = re.compile(
    r"(?:total[es]*|grand\s*total|amount\s*due|to\s*pay|zu\s*zahlen"
    r"|sum|gesamtbetrag|gesamt|betrag|balance\s*due|net\s*amount"
    r"|subtotal|montant)[^0-9]*"
    r"(\d{1,6}[.,]\s*\d{2})",   # allow space between decimal and cents, e.g. '9. 00'
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
    matches = list(_TOTAL_LABEL_RE.finditer(flat))
    if matches:
        v = _to_float(matches[-1].group(1))
        if v is not None:
            return round(v, 2)
    # Fallback: largest price anywhere in the text
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
_WORD_RE        = re.compile(r"[A-Za-z]{3,}")
_QTY_PREFIX_RE  = re.compile(r"^\d+\s*[xX×]\s*")
_QTY_LINE_RE    = re.compile(r"^(\d+)\s*[xX×]\s*(.+)$")   # e.g. "2xLatte Macchiato"
_CURR_CODE_RE   = re.compile(
    r"\b(CHF|EUR|USD|GBP|INR|AED|SGD|AUD|CAD|JPY)\b", re.IGNORECASE
)


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
    return name


# ─── Strategy A: per-line parsing (clear receipts) ───────────────────────────

def _parse_items_per_line(text: str) -> List[Dict]:
    """
    Standard parsing: each item line contains both a word and a price.
    Works well when Tesseract preserves full receipt lines (PSM 6/4).
    """
    items: List[Dict] = []
    for raw_line in text.splitlines():
        line = _clean(raw_line)
        if not line:
            continue
        if _SKIP_PATTERN.search(line):
            continue
        prices = _ITEM_PRICE_RE.findall(line)
        if not prices or not _WORD_RE.search(line):
            continue
        amount = _to_float(prices[-1]) or 0.0
        name = _build_item_name(line)
        if len(name) < 3:
            continue
        items.append({"name": name, "amount": round(amount, 2)})
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

    vendor       = _extract_vendor(raw_text)
    receipt_date = _extract_date(raw_text)
    total_amount = _extract_total(raw_text)
    currency     = _detect_currency(raw_text)

    employee_department = "unassigned"
    if employee_user_id:
        employee_department = get_user_department(employee_user_id, organization_id)

    # DB row – matches existing Supabase schema columns
    row = {
        "receipt_id":          receipt_id,
        "organization_id":     organization_id,
        "uploaded_by":         uploaded_by_user_id,
        "employee_user_id":    employee_user_id,
        "employee_department": employee_department,
        "source_file_name":    file_name,
        "ocr_text":            raw_text,
        "ocr_method":          extraction.get("method", "tesseract"),
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
        "warnings": warnings,
    }
