"""
test_ocr_real_receipt.py
────────────────────────
Smoke test for OCR Track 1 against a real receipt image.

Bypasses FastAPI, Supabase, and all network dependencies.
Tests the full OCR→parse→carbon pipeline end-to-end locally.

Usage:
    cd C:\\Users\\daksh_769tz6y\\Desktop\\carbonsense
    python scripts/test_ocr_real_receipt.py path\\to\\your\\receipt.jpg

    # Or drop the image next to this script and just run:
    python scripts/test_ocr_real_receipt.py

Windows Tesseract tip:
    If you get "TesseractNotFoundError", set the env var before running:
    $env:TESSERACT_CMD = "C:\\Program Files\\Tesseract-OCR\\tesseract.exe"
    python scripts/test_ocr_real_receipt.py
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# ─── Path setup ──────────────────────────────────────────────────────────────
# Allow running from repo root OR from scripts/ folder
SCRIPT_DIR   = Path(__file__).resolve().parent
REPO_ROOT    = SCRIPT_DIR.parent
PACKAGES_DIR = REPO_ROOT / "packages"

for p in (str(PACKAGES_DIR), str(REPO_ROOT)):
    if p not in sys.path:
        sys.path.insert(0, p)

# ─── Stub out Supabase so single_processor.py loads without .env ─────────────
# This replaces the real Supabase client with a no-op for local testing.
import types

_fake_supabase_module = types.ModuleType("supabase")

class _FakeResult:
    data = []

class _FakeTable:
    def insert(self, _row):    return self
    def select(self, *a):      return self
    def eq(self, *a):          return self
    def gte(self, *a):         return self
    def lte(self, *a):         return self
    def execute(self):         return _FakeResult()

class _FakeClient:
    def table(self, _name):    return _FakeTable()

def _fake_create_client(url, key):
    return _FakeClient()

_fake_supabase_module.create_client = _fake_create_client
_fake_supabase_module.Client = _FakeClient
sys.modules.setdefault("supabase", _fake_supabase_module)

# Also stub dotenv if not installed
try:
    import dotenv  # noqa: F401
except ImportError:
    _fake_dotenv = types.ModuleType("dotenv")
    _fake_dotenv.load_dotenv = lambda: None
    sys.modules["dotenv"] = _fake_dotenv

# ─── Now safe to import OCR pipeline ─────────────────────────────────────────
from packages.ml_services.ocr.text_extractor import extract_text
from packages.ml_services.ocr.single_processor import (
    _parse_items,
    _extract_vendor,
    _extract_date,
    _extract_total,
    _detect_currency,
)
from packages.ml_services.ocr.carbon_mapper import (
    calculate_receipt_carbon,
    load_carbon_database,
)

# ─── Helpers ─────────────────────────────────────────────────────────────────

DIVIDER = "─" * 60

def _section(title: str):
    print(f"\n{DIVIDER}")
    print(f"  {title}")
    print(DIVIDER)


def run_ocr_pipeline(image_path: str) -> None:
    p = Path(image_path)
    if not p.exists():
        print(f"\n❌  File not found: {image_path}")
        print("    Usage: python scripts/test_ocr_real_receipt.py path\\to\\receipt.jpg")
        sys.exit(1)

    print(f"\n🧾  Testing OCR Pipeline on: {p.name}")
    print(f"    Full path : {p.resolve()}")
    print(f"    File size : {p.stat().st_size / 1024:.1f} KB")

    # ── Stage 1: Text Extraction ──────────────────────────────────────────────
    _section("STAGE 1 — Text Extraction (text_extractor.py)")
    result = extract_text(str(p))

    if not result.get("success"):
        print(f"❌  Extraction failed: {result.get('error', 'unknown error')}")
        if "TesseractNotFoundError" in str(result.get("error", "")):
            print("\n  Fix: Set TESSERACT_CMD env variable, e.g.")
            print(r'  $env:TESSERACT_CMD = "C:\Program Files\Tesseract-OCR\tesseract.exe"')
        sys.exit(1)

    raw_text = result["text"]
    print(f"✅  OCR method    : {result['method']}")
    print(f"    Confidence   : {result['confidence']:.2%}")
    print(f"    Words found  : {len(raw_text.split())}")
    if result["confidence"] < 0.5:
        print("⚠️   Low confidence — image may be blurry or low-res")
    elif result["confidence"] < 0.7:
        print("⚠️   Moderate confidence — review output carefully")
    else:
        print("✅  Confidence looks good")

    print(f"\n--- Raw OCR Text (first 800 chars) ---")
    print(raw_text[:800])
    if len(raw_text) > 800:
        print(f"  ... [{len(raw_text) - 800} more chars]")

    # ── Stage 2: Metadata Extraction ─────────────────────────────────────────
    _section("STAGE 2 — Metadata Extraction (single_processor.py)")
    vendor   = _extract_vendor(raw_text)
    date     = _extract_date(raw_text)
    total    = _extract_total(raw_text)
    currency = _detect_currency(raw_text)

    print(f"  Vendor   : {vendor   or '(not detected)'}")
    print(f"  Date     : {date     or '(not detected)'}")
    print(f"  Total    : {total    or '(not detected)'}")
    print(f"  Currency : {currency}")

    # ── Stage 3: Line Item Parsing ────────────────────────────────────────────
    _section("STAGE 3 — Line Item Parsing (single_processor.py)")
    items = _parse_items(raw_text)
    print(f"  Items parsed: {len(items)}")

    if items:
        print("\n  Parsed items:")
        for i, item in enumerate(items, 1):
            qty = item.get("quantity", 1)
            qty_str = f"  ×{qty}" if qty > 1 else ""
            print(f"    {i:2}. {item['name']:<35}  {item.get('amount', 0.0):>8.2f} {currency}{qty_str}")
    else:
        print("\n  ⚠️  No items parsed.")
        print("  Possible reasons:")
        print("    • Receipt has no price-like patterns (XX.XX)")
        print("    • Items and prices are on completely separate lines with no blank-line grouping")
        print("    • OCR quality too low — check confidence above")

    # ── Stage 4: Carbon Mapping ───────────────────────────────────────────────
    _section("STAGE 4 — Carbon Mapping (carbon_mapper.py)")
    carbon_db     = load_carbon_database()
    carbon_result = calculate_receipt_carbon(items, carbon_db)

    mapped   = carbon_result["mapped_items"]
    unmapped_count = len(items) - len(mapped)

    print(f"  Items mapped     : {len(mapped)}")
    print(f"  Items unmapped   : {unmapped_count}  (carbon_kg = 0 for these)")
    print(f"  Total carbon     : {carbon_result['total_carbon_kg']:.4f} kg CO₂e")

    if mapped:
        print(f"\n  Carbon breakdown:")
        # Group by category
        by_cat: dict[str, float] = {}
        for item in mapped:
            cat = item.get("category", "unknown")
            by_cat[cat] = by_cat.get(cat, 0.0) + float(item.get("carbon_kg", 0))

        for cat, kg in sorted(by_cat.items(), key=lambda x: -x[1]):
            bar = "█" * int(kg * 10)
            print(f"    {cat:<25}  {kg:>6.3f} kg  {bar}")

        print(f"\n  Item detail:")
        for item in sorted(mapped, key=lambda x: -x.get("carbon_kg", 0)):
            qty = item.get("quantity", 1)
            qty_str = f"  ×{qty}" if qty > 1 else ""
            print(
                f"    {item['name']:<35}  "
                f"{item.get('carbon_kg', 0):>6.4f} kg  "
                f"[{item.get('category', 'unknown')}]{qty_str}"
            )

    # ── Summary ───────────────────────────────────────────────────────────────
    _section("SUMMARY")

    total_kg = carbon_result["total_carbon_kg"]
    map_rate = len(mapped) / max(len(items), 1) * 100

    print(f"  ✅  OCR confidence      : {result['confidence']:.2%}  (target > 70%)")
    print(f"  {'✅' if len(items) > 0 else '⚠️ '} Items parsed         : {len(items)}")
    print(f"  {'✅' if map_rate >= 50 else '⚠️ '} Carbon map rate      : {map_rate:.0f}%  (aim > 50%)")
    print(f"  📊  Total carbon         : {total_kg:.4f} kg CO₂e")
    print(f"  🌳  Trees to offset      : ~{total_kg / 0.025:.1f} Neem trees (1 year)")
    print(f"  🔥  vs. avg petrol fill  : {total_kg / 2.31:.1f}× a 10L petrol fill")

    # Optionally save full JSON
    output_path = REPO_ROOT / "scripts" / f"ocr_result_{p.stem}.json"
    full_result = {
        "file": str(p.name),
        "ocr_method": result["method"],
        "confidence": result["confidence"],
        "vendor": vendor,
        "date": date,
        "total_amount": total,
        "currency": currency,
        "items_parsed": len(items),
        "carbon_total_kg": total_kg,
        "carbon_mapped_items": mapped,
        "raw_text_preview": raw_text[:300],
    }
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(full_result, f, indent=2, ensure_ascii=False)

    print(f"\n  💾  Full result saved to: {output_path.relative_to(REPO_ROOT)}")
    print(f"\n{'═' * 60}")


# ─── Entry point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) >= 2:
        image_arg = sys.argv[1]
    else:
        # Look for any image in the scripts folder as a convenience
        for ext in ("*.jpg", "*.jpeg", "*.png"):
            found = list(Path(SCRIPT_DIR).glob(ext))
            if found:
                image_arg = str(found[0])
                print(f"ℹ️  No path given — using: {found[0].name}")
                break
        else:
            print("Usage: python scripts/test_ocr_real_receipt.py path\\to\\receipt.jpg")
            print("       OR drop a .jpg into the scripts/ folder and re-run.")
            sys.exit(1)

    run_ocr_pipeline(image_arg)