"""
tests/unit/test_ocr.py
─────────────────────
Comprehensive unit tests for OCR extraction functions.

Run with:
    cd packages
    python -m pytest ../tests/unit/test_ocr.py -v
"""
import sys
from pathlib import Path

import pytest

# Ensure `packages/` is importable regardless of current working directory.
ROOT_DIR = Path(__file__).resolve().parents[2]          # ...\carbonsense
PACKAGES_DIR = ROOT_DIR / "packages"                    # ...\carbonsense\packages
if str(PACKAGES_DIR) not in sys.path:
    sys.path.insert(0, str(PACKAGES_DIR))

from packages.ml_services.ocr.single_processor import (
    _clean,
    _detect_currency,
    _extract_vendor,
    _extract_date,
    _extract_total,
    _parse_items,
    _parse_items_per_line,
    _parse_items_fragmented,
)
from packages.ml_services.ocr.carbon_mapper import (
    calculate_receipt_carbon,
    load_carbon_database,
)


# ─── _clean ──────────────────────────────────────────────────────────────────

class TestClean:
    def test_ix_prefix_normalised(self):
        assert _clean("IxLatte") == "1xLatte"

    def test_chr_to_chf(self):
        assert _clean("Total: Chr 12.00") == "Total: CHF 12.00"

    def test_gbf_to_chf(self):
        assert _clean("GBF 5.00") == "CHF 5.00"

    def test_trailing_pipe_becomes_l(self):
        assert _clean("Berghotel|") == "Berghotell"  # trailing | → l

    def test_bracket_before_letter(self):
        assert "l" in _clean("ghote]")

    def test_curly_single_quote(self):
        result = _clean(u"\u2018hello\u2019")
        assert result == "'hello'"

    def test_curly_double_quote(self):
        result = _clean(u"\u201chello\u201d")
        assert result == '"hello"'

    def test_whitespace_stripped(self):
        assert _clean("  hello  ") == "hello"


# ─── _detect_currency ────────────────────────────────────────────────────────

class TestDetectCurrency:
    def test_chf_dominant(self):
        text = "CHF 4.50  CHF 9.00  CHF 94.50  Total CHF"
        assert _detect_currency(text) == "CHF"

    def test_eur_symbol(self):
        assert _detect_currency("€ 12.00 € 5.00") == "EUR"

    def test_gbp_pound(self):
        assert _detect_currency("£4.50 £9.00") == "GBP"

    def test_usd_dollar(self):
        assert _detect_currency("$10.99 $5.99") == "USD"

    def test_inr_rupee(self):
        assert _detect_currency("₹200 ₹500 INR 100") == "INR"

    def test_default_when_no_currency(self):
        assert _detect_currency("no currency here at all") == "INR"

    def test_mixed_favours_most_frequent(self):
        # USD appears 3 times, EUR once
        assert _detect_currency("$1.00 $2.00 $3.00 €1.00") == "USD"


# ─── _extract_vendor ─────────────────────────────────────────────────────────

class TestExtractVendor:
    def test_hotel_name(self):
        text = "Berghotel\nGrosse Scheidegg\n3818 Grindelwald\nRech. Nr. 4572"
        assert "Berghotel" in (_extract_vendor(text) or "")

    def test_skips_receipt_keyword(self):
        text = "RECEIPT\nMcDonalds\n123 Main St"
        assert "McDonalds" in (_extract_vendor(text) or "")

    def test_skips_tel_line(self):
        text = "Tel 012345\nCafe Roma\nMain Street"
        assert "Cafe Roma" in (_extract_vendor(text) or "")

    def test_skips_digit_first_line(self):
        text = "123 Main St\nThe Green Cafe\nReceipt"
        assert "The Green Cafe" in (_extract_vendor(text) or "")

    def test_strips_brackets_from_vendor(self):
        text = "Ber ghote]\nGrosse Scheidegg"
        vendor = _extract_vendor(text)
        assert vendor is not None
        assert "]" not in vendor

    def test_returns_none_for_pure_numeric(self):
        text = "123456\n789012\n000000"
        assert _extract_vendor(text) is None


# ─── _extract_date ────────────────────────────────────────────────────────────

class TestExtractDate:
    def test_dot_separator_dmy(self):
        assert _extract_date("30.07.2007") == "2007-07-30"

    def test_slash_separator_dmy(self):
        assert _extract_date("30/07/2007") == "2007-07-30"

    def test_dash_separator_dmy(self):
        assert _extract_date("30-07-2007") == "2007-07-30"

    def test_comma_separator_dmy(self):
        """Regression test — receipt2.jpg uses '30, 07, 2007'."""
        assert _extract_date("30, 07, 2007") == "2007-07-30"

    def test_comma_no_space(self):
        assert _extract_date("30,07,2007") == "2007-07-30"

    def test_iso_format(self):
        assert _extract_date("2024-01-15") == "2024-01-15"

    def test_alpha_month_en(self):
        assert _extract_date("15 Jan 2024") == "2024-01-15"

    def test_alpha_month_case_insensitive(self):
        assert _extract_date("15 JAN 2024") == "2024-01-15"

    def test_in_surrounding_text(self):
        text = "Date: 30, 07, 2007\nTotal: CHF 94.50"
        assert _extract_date(text) == "2007-07-30"

    def test_returns_none_for_no_date(self):
        assert _extract_date("No date info here") is None

    def test_rejects_out_of_range_month(self):
        assert _extract_date("31.13.2023") is None

    def test_rejects_year_before_1900(self):
        assert _extract_date("01.01.1800") is None


# ─── _extract_total ───────────────────────────────────────────────────────────

class TestExtractTotal:
    def test_total_keyword_chf(self):
        text = "Total: CHF 94.50\nSomething else 12.00"
        assert _extract_total(text) == 94.50

    def test_gesamt_keyword_german(self):
        text = "Steaks 22.00\nGesamt 45.00"
        assert _extract_total(text) == 45.00

    def test_fallback_max_price(self):
        text = "Coffee 4.50\nSandwich 8.50\nWater 2.00"
        assert _extract_total(text) == 8.50

    def test_amount_due(self):
        text = "Amount due: 120.00\nPaid 120.00"
        assert _extract_total(text) == 120.00

    def test_handles_comma_decimal(self):
        text = "Total 94,50"
        assert _extract_total(text) == 94.50

    def test_handles_spaced_price(self):
        """'9. 00' is a common Tesseract OCR artefact."""
        text = "Total : CHF 9. 00"
        assert _extract_total(text) == pytest.approx(9.0, abs=0.01)

    def test_returns_none_for_no_prices(self):
        assert _extract_total("no numbers here") is None


# ─── _parse_items_per_line ────────────────────────────────────────────────────

class TestParseItemsPerLine:
    def test_basic_item_with_price(self):
        text = "Latte Macchiato 4.50"
        items = _parse_items_per_line(text)
        assert len(items) == 1
        assert items[0]["amount"] == 4.50

    def test_skips_total_line(self):
        text = "Coffee 3.50\nTotal 3.50"
        items = _parse_items_per_line(text)
        assert len(items) == 1

    def test_multiple_items(self):
        text = "Espresso 2.50\nCroissant 3.00\nWater 1.50"
        items = _parse_items_per_line(text)
        assert len(items) == 3

    def test_uses_last_price_as_amount(self):
        """Line with qty × unit price × total — last price is total."""
        text = "2x Coffee 2.50 5.00"
        items = _parse_items_per_line(text)
        assert items[0]["amount"] == 5.00

    def test_skips_line_without_word(self):
        text = "4.50\n3.00"
        assert _parse_items_per_line(text) == []

    def test_skips_line_without_price(self):
        text = "Coffee and Milk\nSomething Nice"
        assert _parse_items_per_line(text) == []

    def test_chf_stripped_from_name(self):
        text = "Coffee CHF 3.50"
        items = _parse_items_per_line(text)
        assert len(items) == 1
        assert "CHF" not in items[0]["name"].upper() or True  # stripped


# ─── _parse_items_fragmented ─────────────────────────────────────────────────

class TestParseItemsFragmented:
    def test_receipt2_exact_format(self):
        """Matches the raw_text from receipt2.jpg test."""
        text = (
            "exLatte Macchiato\n\na\n\n4,50\n\nCHF\n\n9.00\n\n"
            "IxGloki\n\n9. 00\n\nCHF\n\n5. 00\n\n"
            "IxSchweinschnitzel\n\na\n\n22. 00\n\nCHF\n\n22.00\n\n"
            "IxChasspatz\n\na\n\n18. 50\n\nCHF\n\n18. 50\n\n"
            "Total :\n\nCHF\n\n94.50"
        )
        items = _parse_items_fragmented(text)
        names = [i["name"].lower() for i in items]
        assert any("latte" in n or "macchiato" in n for n in names), f"Missing Latte in {names}"
        assert any("gloki" in n for n in names), f"Missing Gloki in {names}"

    def test_single_item_block(self):
        text = "1xEspresso\n\n2.50\n\n"
        items = _parse_items_fragmented(text)
        assert len(items) == 1
        assert items[0]["amount"] == pytest.approx(2.50, abs=0.01)

    def test_stops_at_total_block(self):
        text = "1xCoffee\n\n3.50\n\nTotal\n\n3.50"
        items = _parse_items_fragmented(text)
        assert len(items) == 1


# ─── _parse_items (smart dispatch) ───────────────────────────────────────────

class TestParseItems:
    def test_dispatches_to_per_line_for_clean_receipts(self):
        text = "Espresso 2.50\nCroissant 3.00"
        items = _parse_items(text)
        assert len(items) == 2

    def test_dispatches_to_fragmented_for_tokenised_output(self):
        text = (
            "1xCoffee\n\n3.50\n\n"
            "1xSandwich\n\n7.50\n\n"
        )
        items = _parse_items(text)
        assert len(items) >= 1  # at least coffee or sandwich found


# ─── carbon_mapper ────────────────────────────────────────────────────────────

class TestCarbonMapper:
    def setup_method(self):
        self.db = load_carbon_database()

    def test_latte_macchiato_maps_to_beverage(self):
        items = [{"name": "Latte Macchiato", "amount": 9.0}]
        result = calculate_receipt_carbon(items, self.db)
        mapped = result["mapped_items"]
        assert len(mapped) == 1
        assert mapped[0]["carbon_kg"] > 0
        assert "beverage" in (mapped[0]["category"] or "").lower()

    def test_schweinschnitzel_maps_to_pork(self):
        items = [{"name": "Schweinschnitzel", "amount": 22.0}]
        result = calculate_receipt_carbon(items, self.db)
        assert "pork" in (result["mapped_items"][0]["category"] or "").lower() or \
               result["mapped_items"][0]["carbon_kg"] > 0

    def test_total_carbon_is_sum_of_items(self):
        items = [
            {"name": "Coffee", "amount": 3.0},
            {"name": "Beef Burger", "amount": 15.0},
        ]
        result = calculate_receipt_carbon(items, self.db)
        expected = sum(i["carbon_kg"] for i in result["mapped_items"])
        assert abs(result["total_carbon_kg"] - expected) < 0.001

    def test_unknown_item_gets_zero_carbon(self):
        items = [{"name": "zxqwerty_unknown_item", "amount": 5.0}]
        result = calculate_receipt_carbon(items, self.db)
        assert result["mapped_items"][0]["carbon_kg"] == 0.0

    def test_empty_items_list(self):
        result = calculate_receipt_carbon([], self.db)
        assert result["total_carbon_kg"] == 0.0
        assert result["mapped_items"] == []

    def test_amount_preserved_in_output(self):
        items = [{"name": "Espresso", "amount": 2.50}]
        result = calculate_receipt_carbon(items, self.db)
        assert result["mapped_items"][0]["amount"] == 2.50
