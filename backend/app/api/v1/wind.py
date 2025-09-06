from fastapi import APIRouter, HTTPException
import logging
from app.schemas.common import WindForTrackRequest, WindForTrackResult, WindedPoint
from app.services.wind import fetch_openmeteo_hourly_auto, map_wind
from app.services import parsing as P

router = APIRouter(tags=["wind"])
log = logging.getLogger("xboat-api")

@router.post("/wind-for-track", response_model=WindForTrackResult)
async def wind_for_track(req: WindForTrackRequest, return_full: bool = False):
    if not req.points:
        raise HTTPException(status_code=400, detail="No points provided.")

    # window + representative coordinate
    start_dt, end_dt = _window(req.points)
    lat, lon = _representative_coord(req.points, req.coord_strategy or "centroid")

    source_used, times, u, v = await fetch_openmeteo_hourly_auto(lat, lon, start_dt, end_dt, req.source_preference or "auto")
    mapped = map_wind([p.dict() for p in req.points], times, u, v)

    return WindForTrackResult(
        source=source_used,
        lat_used=lat, lon_used=lon,
        start_time=start_dt.isoformat(), end_time=end_dt.isoformat(),
        hourly_count=len(times), mapped_count=len(mapped),
        sample=[WindedPoint(**mapped[i]) for i in range(min(5, len(mapped)))],
        points=[WindedPoint(**p) for p in mapped] if return_full else None
    )

def _window(points):
    dts = [P.to_dt(p.timestamp) for p in points if p.timestamp]
    dts = [d for d in dts if d is not None]
    if not dts:
        raise HTTPException(status_code=400, detail="No valid timestamps in points.")
    return (min(dts), max(dts))

def _representative_coord(points, strategy="centroid"):
    coords = [(p.lat, p.lon) for p in points if (p.lat is not None and p.lon is not None)]
    if not coords:
        raise HTTPException(status_code=400, detail="No valid lat/lon coordinates in points.")
    if strategy == "start":
        lat, lon = coords[0]
    elif strategy == "midpoint":
        lat, lon = coords[len(coords)//2]
    else:
        lats = sorted([c[0] for c in coords]); lons = sorted([c[1] for c in coords])
        lat = lats[len(lats)//2]; lon = lons[len(lons)//2]
    return float(lat), float(lon)
