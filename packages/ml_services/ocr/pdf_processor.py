"""
pdf_processor.py
────────────────
PDF receipt support for CarbonSense ML Service.

Uses PyMuPDF (fitz) to render each page of a PDF at high DPI,
then passes each page image through the standard OCR pipeline
(text_extractor.py) to produce combined receipt text.

Usage:
    from ml_services.ocr.pdf_processor import extract_text_from_pdf

    result = extract_text_from_pdf("/path/to/receipt.pdf")
    # Returns same schema as text_extractor.extract_text()
"""

from __future__ import annotations

import io
import os
import tempfile
from typing import Dict, List

from PIL import Image

from ml_services.ocr.text_extractor import extract_text


# Render resolution — 200 DPI is a good balance of speed vs Tesseract quality.
# Receipts rarely benefit from > 300 DPI once Tesseract upscaling kicks in.
_RENDER_DPI = 200


def _pdf_pages_to_pil(pdf_path: str) -> List[Image.Image]:
    """
    Render all pages of a PDF to PIL Images using PyMuPDF.
    Returns list of RGB PIL Images.
    """
    try:
        import fitz  # noqa: F401  (pymupdf)
    except ImportError:
        raise ImportError(
            "PyMuPDF is required for PDF support. "
            "Install it with: pip install pymupdf"
        )

    pages: List[Image.Image] = []
    mat = fitz.Matrix(_RENDER_DPI / 72.0, _RENDER_DPI / 72.0)

    with fitz.open(pdf_path) as doc:
        for page in doc:
            pixmap = page.get_pixmap(matrix=mat, colorspace=fitz.csRGB)
            img_bytes = pixmap.tobytes("png")
            pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            pages.append(pil_img)

    return pages


def extract_text_from_pdf(pdf_path: str) -> Dict:
    """
    Extract text from a PDF receipt file.

    Renders each page to an image and passes it through the Tesseract
    multi-PSM pipeline.  For multi-page PDFs the text from all pages is
    joined with a page-break separator.

    Returns the same schema as text_extractor.extract_text():
        {
            "text":       str,
            "method":     str,
            "success":    bool,
            "confidence": float,   # mean across all pages
            "error":      str,     # only present on failure
            "pages":      int,     # number of PDF pages processed
        }
    """
    if not os.path.exists(pdf_path):
        return {
            "text": "",
            "method": "pdf-ocr",
            "success": False,
            "confidence": 0.0,
            "error": f"File not found: {pdf_path}",
            "pages": 0,
        }

    try:
        pages = _pdf_pages_to_pil(pdf_path)
    except ImportError as exc:
        return {
            "text": "",
            "method": "pdf-ocr",
            "success": False,
            "confidence": 0.0,
            "error": str(exc),
            "pages": 0,
        }
    except Exception as exc:
        return {
            "text": "",
            "method": "pdf-ocr",
            "success": False,
            "confidence": 0.0,
            "error": f"PDF render failed: {exc}",
            "pages": 0,
        }

    page_texts: List[str] = []
    page_confs: List[float] = []
    any_success = False

    with tempfile.TemporaryDirectory() as tmp_dir:
        for i, pil_page in enumerate(pages):
            tmp_path = os.path.join(tmp_dir, f"page_{i:04d}.png")
            pil_page.save(tmp_path, format="PNG")

            result = extract_text(tmp_path)
            if result.get("success"):
                any_success = True

            text = result.get("text", "")
            if text.strip():
                page_texts.append(text)
                page_confs.append(result.get("confidence", 0.0))

    combined_text = "\n\n--- PAGE BREAK ---\n\n".join(page_texts)
    mean_conf = (sum(page_confs) / len(page_confs)) if page_confs else 0.0

    return {
        "text": combined_text,
        "method": f"pdf-ocr-{len(pages)}pages",
        "success": any_success,
        "confidence": round(mean_conf, 4),
        "pages": len(pages),
    }
