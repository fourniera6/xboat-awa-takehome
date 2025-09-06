from fastapi import APIRouter, UploadFile, File, HTTPException
import logging
from app.schemas.common import Point, ParseResult
from app.services import parsing as P

router = APIRouter(tags=["gps"])
log = logging.getLogger("xboat-api")

@router.post("/parse-gps", response_model=ParseResult)
async def parse_gps(file: UploadFile = File(...), return_full: bool = False):
    head = await file.read(4096)
    file_type = P.detect_file_type(file.filename or "upload", head)
    if file_type == "unknown":
        raise HTTPException(status_code=400, detail="Could not detect file type (gpx/tcx/fit).")
    await file.seek(0)
    data = await file.read()

    if file_type == "gpx":
        points = P.parse_gpx(data)
    elif file_type == "tcx":
        points = P.parse_tcx(data)
    elif file_type == "fit":
        points = P.parse_fit(data)
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type.")

    derived = P.derive_speeds(points)
    log.info(f"Speed derivation: {'YES' if derived else 'NO'} ({derived} of {len(points)} points)")

    pts_sorted = sorted(points, key=lambda p: (p["timestamp"] or ""))
    start = next((p["timestamp"] for p in pts_sorted if p["timestamp"]), None)
    end   = next((p["timestamp"] for p in reversed(pts_sorted) if p["timestamp"]), None)
    res = ParseResult(
        file_type=file_type,
        num_points=len(pts_sorted),
        start_time=start,
        end_time=end,
        bounds=P.bounds(pts_sorted),
        sample=[Point(**p) for p in pts_sorted[:5]],
        points=[Point(**p) for p in pts_sorted] if return_full else None,
    )
    return res
