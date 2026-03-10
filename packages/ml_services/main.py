from fastapi import FastAPI
from ml_services.ocr.api import router as ocr_router
from ml_services.food.api import router as food_router

app = FastAPI(title="CarbonSense ML Services")
app.include_router(ocr_router)
app.include_router(food_router)

