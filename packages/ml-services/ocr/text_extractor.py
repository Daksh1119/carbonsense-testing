from typing import Dict
import pytesseract
from PIL import Image


def extract_text(image_path: str) -> Dict:
    """
    Production note:
    - Add EasyOCR fallback if pytesseract confidence is low.
    - Add PDF pipeline (pdf2image + OCR per page) if needed.
    """
    text = pytesseract.image_to_string(Image.open(image_path))
    return {
        "text": text or "",
        "method": "tesseract",
    }