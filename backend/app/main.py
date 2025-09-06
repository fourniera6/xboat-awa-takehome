import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.v1.gps import router as gps_router
from app.api.v1.wind import router as wind_router

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s | %(levelname)s | %(message)s",
)
log = logging.getLogger("xboat-api")

app = FastAPI(title="XBoat GPS + Wind API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(gps_router, prefix="/api/v1")
app.include_router(wind_router, prefix="/api/v1")

@app.get("/health")
def health():
    return {"status": "ok"}
