from fastapi import APIRouter, HTTPException
import logging
from app.schemas.common import (
    ApparentWindRequest, ApparentWindResult, ApparentPoint
)
from app.services.apparent import (
    apparent_from_true, track_window, representative_coord
)
from app.services.wind import fetch_openmeteo_hourly_auto, map_wind

router = APIRouter(tags=["apparent-wind"])
log = logging.getLogger("xboat-api")

@router.get("/apparent-wind/ping")
def ping():
    return {"ok": True}

@router.post("/apparent-wind", response_model=ApparentWindResult)
async def apparent_wind(req: ApparentWindRequest, return_full: bool = False):
    if not req.points:
        raise HTTPException(status_code=400, detail="No points provided.")

    pts = [p.dict() for p in req.points]

    # fetch wind if any point lacks it
    source_used = None
    lat_used = None
    lon_used = None
    if req.fetch_wind_if_missing and any(p.get("wind_u10_ms") is None or p.get("wind_v10_ms") is None for p in pts):
        start_dt, end_dt = track_window(pts)
        lat_used, lon_used = representative_coord(pts, strategy=(req.coord_strategy or "centroid"))
        source_used, times, u, v = await fetch_openmeteo_hourly_auto(
            lat_used, lon_used, start_dt, end_dt, req.source_preference or "auto"
        )
        pts = map_wind(pts, times, u, v)

    out = apparent_from_true(pts, min_speed_ms=(req.min_speed_ms or 0.5))

    start_dt, end_dt = track_window(pts)

    return ApparentWindResult(
        source=source_used,
        lat_used=lat_used,
        lon_used=lon_used,
        start_time=start_dt.isoformat(),
        end_time=end_dt.isoformat(),
        mapped_count=len(out),
        sample=[ApparentPoint(**out[i]) for i in range(min(5, len(out)))],
        points=[ApparentPoint(**p) for p in out] if return_full else None,
    )
