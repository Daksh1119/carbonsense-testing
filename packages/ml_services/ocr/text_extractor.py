"""
text_extractor.py
─────────────────
Multi-pass Tesseract OCR with image pre-processing pipeline.

Pre-processing steps (in order):
  1. Convert to greyscale
  2. Upscale if longest edge < 1500 px  (improves DPI for small scans)
  3. Sharpen
  4. Auto-contrast  (clips 2 % histogram outliers)
  5. Hard-binarise at midpoint 128

Tesseract is tried with PSM modes [6, 4, 3, 11].  The run with the
highest mean per-word confidence is kept.  If best confidence < 0.50
the raw greyscale image is also tried as a fallback.

Returns a dict with keys:
  text        – extracted string
  method      – e.g. "tesseract-psm6"
  success     – bool
  confidence  – float 0.0–1.0  (mean Tesseract per-word confidence)
  error       – str  (only present on failure)
"""

from __future__ import annotations

import os
from typing import Dict

import pytesseract
from PIL import Image, ImageEnhance, ImageFilter, ImageOps, UnidentifiedImageError


def _easyocr_enabled() -> bool:
    return os.getenv("OCR_ENABLE_EASYOCR_FALLBACK", "false").strip().lower() == "true"


def _easyocr_min_gain() -> float:
    try:
        return float(os.getenv("OCR_EASYOCR_MIN_GAIN", "0.05"))
    except ValueError:
        return 0.05


def _run_easyocr(image_path: str) -> Dict:
    """
    Optional EasyOCR fallback. Returns the same shape as extract_text snippets.
    Import is local to keep startup lightweight when EasyOCR is not installed.
    """
    try:
        import easyocr  # type: ignore
    except Exception as e:
        return {
            "text": "",
            "method": "easyocr",
            "success": False,
            "confidence": 0.0,
            "error": f"EasyOCR unavailable: {e}",
        }

    try:
        reader = easyocr.Reader(["en"], gpu=False, verbose=False)
        chunks = reader.readtext(image_path, detail=1)
        texts = [str(row[1]).strip() for row in chunks if len(row) >= 2 and str(row[1]).strip()]
        confs = [float(row[2]) for row in chunks if len(row) >= 3]
        mean_conf = (sum(confs) / len(confs)) if confs else 0.0
        return {
            "text": "\n".join(texts).strip(),
            "method": "easyocr",
            "success": bool(texts),
            "confidence": round(mean_conf, 4),
        }
    except Exception as e:
        return {
            "text": "",
            "method": "easyocr",
            "success": False,
            "confidence": 0.0,
            "error": f"EasyOCR failed: {type(e).__name__}: {e}",
        }


# ─── Image pre-processing ────────────────────────────────────────────────────

def _preprocess(img: Image.Image) -> Image.Image:
    """Return a binarised greyscale copy optimised for Tesseract."""
    img = img.convert("L")
    w, h = img.size
    longest = max(w, h)
    if longest < 1500:
        scale = 1500.0 / longest
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    img = img.filter(ImageFilter.SHARPEN)
    img = ImageOps.autocontrast(img, cutoff=2)
    img = img.point(lambda px: 255 if px > 128 else 0, "L")
    return img


# ─── Confidence helper ───────────────────────────────────────────────────────

def _mean_confidence(data: dict) -> float:
    """Mean word confidence (0–1) from pytesseract image_to_data output."""
    confs = [
        int(c)
        for c in data.get("conf", [])
        if str(c).lstrip("-").isdigit() and int(c) >= 0
    ]
    return (sum(confs) / len(confs) / 100.0) if confs else 0.0


# ─── Main extractor ──────────────────────────────────────────────────────────

def extract_text(image_path: str) -> Dict:
    """
    Extract text from a receipt image using Tesseract OCR.

    Tries PSM modes 6, 4, 3, 11 on the pre-processed image and falls back
    to raw greyscale if confidence remains below 0.50.
    """
    tesseract_cmd = os.getenv("TESSERACT_CMD")
    if tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

    if not os.path.exists(image_path):
        return {
            "text": "",
            "method": "tesseract",
            "success": False,
            "confidence": 0.0,
            "error": f"File not found: {image_path}",
        }

    try:
        with Image.open(image_path) as raw_pil:
            raw_pil = raw_pil.convert("RGB")
            preprocessed = _preprocess(raw_pil.copy())

        best_text = ""
        best_conf = 0.0
        best_method = "tesseract-psm6"

        # ── Multi-PSM sweep on pre-processed image ───────────────────────────
        for psm in (6, 4, 3, 11):
            cfg = f"--oem 3 --psm {psm}"
            try:
                data = pytesseract.image_to_data(
                    preprocessed,
                    output_type=pytesseract.Output.DICT,
                    config=cfg,
                )
                conf = _mean_confidence(data)
                text = pytesseract.image_to_string(preprocessed, config=cfg)
                if conf > best_conf or (
                    conf == best_conf and len(text) > len(best_text)
                ):
                    best_conf = conf
                    best_text = text
                    best_method = f"tesseract-psm{psm}"
            except Exception:
                continue

        # ── Low-confidence fallback: raw greyscale ───────────────────────────
        if best_conf < 0.50:
            with Image.open(image_path) as raw_pil:
                raw_gray = raw_pil.convert("L")
            for psm in (6, 4):
                cfg = f"--oem 3 --psm {psm}"
                try:
                    data = pytesseract.image_to_data(
                        raw_gray,
                        output_type=pytesseract.Output.DICT,
                        config=cfg,
                    )
                    conf = _mean_confidence(data)
                    text = pytesseract.image_to_string(raw_gray, config=cfg)
                    if conf > best_conf:
                        best_conf = conf
                        best_text = text
                        best_method = f"tesseract-raw-psm{psm}"
                except Exception:
                    continue

        # ── Optional low-confidence fallback: EasyOCR ────────────────────────
        # Opt-in only, so existing deployments stay unchanged unless enabled.
        if _easyocr_enabled() and best_conf < 0.50:
            easy = _run_easyocr(image_path)
            gain = easy.get("confidence", 0.0) - best_conf
            if easy.get("success") and gain >= _easyocr_min_gain():
                best_conf = float(easy.get("confidence", best_conf))
                best_text = str(easy.get("text", best_text))
                best_method = str(easy.get("method", "easyocr"))

        return {
            "text": best_text.strip() if best_text else "",
            "method": best_method,
            "success": bool(best_text.strip()),
            "confidence": round(best_conf, 4),
        }

    except UnidentifiedImageError:
        return {
            "text": "",
            "method": "tesseract",
            "success": False,
            "confidence": 0.0,
            "error": "Invalid or unsupported image format.",
        }

    except pytesseract.TesseractNotFoundError:
        return {
            "text": "",
            "method": "tesseract",
            "success": False,
            "confidence": 0.0,
            "error": (
                "Tesseract binary not found. Install Tesseract OCR and set "
                r"TESSERACT_CMD (e.g. C:\Program Files\Tesseract-OCR\tesseract.exe)."
            ),
        }

    except Exception as exc:
        return {
            "text": "",
            "method": "tesseract",
            "success": False,
            "confidence": 0.0,
            "error": f"OCR extraction failed: {type(exc).__name__}: {exc}",
        }