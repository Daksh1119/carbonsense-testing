from typing import Dict
import os

import pytesseract
from PIL import Image, UnidentifiedImageError


def extract_text(image_path: str) -> Dict:
    """
    Extract text from an image using Tesseract OCR.

    Production notes:
    - Add EasyOCR fallback if pytesseract confidence is low.
    - Add PDF pipeline (pdf2image + OCR per page) if needed.
    """

    # Optional explicit tesseract binary path (Windows-friendly)
    tesseract_cmd = os.getenv("TESSERACT_CMD")
    if tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

    if not os.path.exists(image_path):
        return {
            "text": "",
            "method": "tesseract",
            "success": False,
            "error": f"File not found: {image_path}",
        }

    try:
        with Image.open(image_path) as img:
            text = pytesseract.image_to_string(img)

        return {
            "text": text or "",
            "method": "tesseract",
            "success": True,
        }

    except UnidentifiedImageError:
        return {
            "text": "",
            "method": "tesseract",
            "success": False,
            "error": "Invalid or unsupported image format.",
        }

    except pytesseract.TesseractNotFoundError:
        return {
            "text": "",
            "method": "tesseract",
            "success": False,
            "error": (
                "Tesseract binary not found. Install Tesseract OCR and set "
                "TESSERACT_CMD (e.g., C:\\Program Files\\Tesseract-OCR\\tesseract.exe)."
            ),
        }

    except Exception as e:
        return {
            "text": "",
            "method": "tesseract",
            "success": False,
            "error": f"OCR extraction failed: {type(e).__name__}: {e}",
        }