from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime


class OCRItem(BaseModel):
    name: str
    amount: Optional[float] = None
    category: Optional[str] = "unknown"
    carbon_kg: Optional[float] = 0.0


class OCRCarbonAnalysis(BaseModel):
    total_carbon_kg: float = 0.0
    mapped_items: List[OCRItem] = Field(default_factory=list)


class ReceiptResult(BaseModel):
    receipt_id: str
    organization_id: str
    uploaded_by: str
    employee_user_id: Optional[str] = None
    employee_department: Optional[str] = "unassigned"
    source_file_name: str
    ocr_text: str
    ocr_method: str
    carbon_analysis: OCRCarbonAnalysis
    status: str = "processed"
    processed_at: datetime


class BulkReceiptResponse(BaseModel):
    total_receipts: int
    processed: int
    failed: int
    failed_receipts: List[Dict[str, Any]]
    total_carbon_kg: float
    receipts: List[ReceiptResult]
    organization_summary: Dict[str, Any]