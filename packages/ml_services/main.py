from fastapi import FastAPI
from ml_services.ocr.api import router as ocr_router

app = FastAPI(title="CarbonSense ML Services")
app.include_router(ocr_router)

