from fastapi import FastAPI
from ocr.api import router as ocr_router

app = FastAPI(title="CarbonSense ML Services")
app.include_router(ocr_router)
