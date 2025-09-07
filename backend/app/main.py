import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.api.v1.gps import router as gps_router
from app.api.v1.wind import router as wind_router
from app.api.v1.apparent import router as apparent_router

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
app.include_router(apparent_router, prefix="/api/v1")

# --- resolve <repo>/backend/sample_data as an absolute path ---
HERE = Path(__file__).resolve().parent         # backend/app
BACKEND_ROOT = HERE.parent                     # backend
SAMPLES_DIR = BACKEND_ROOT / "sample_data"     # backend/sample_data

# (Optional) create it so StaticFiles doesn't crash if missing.
SAMPLES_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/samples", StaticFiles(directory=str(SAMPLES_DIR)), name="samples")

@app.get("/health")
def health():
    return {"status": "ok"}
