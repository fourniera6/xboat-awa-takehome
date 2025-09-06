from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Tuple, Dict
import io
import os
import logging
import datetime
import math
import bisect

# External libs
import httpx
import gpxpy
import gpxpy.gpx
from lxml import etree
import fitdecode


# ---------------- Logging ----------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)
log = logging.getLogger("gps-parser")


# ---------------- FastAPI ----------------
app = FastAPI(title="GPS Parser + Wind (XBoat Takehome – Steps 1–2)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)


# ---------------- Models ----------------
class Point(BaseModel):
    timestamp: Optional[str]
    lat: Optional[float]
    lon: Optional[float]
    altitude_m: Optional[float] = None
    speed_m_s: Optional[float] = None
    heart_rate_bpm: Optional[int] = None
    cadence_rpm: Optional[int] = None


class ParseResult(BaseModel):
    file_type: str
    num_points: int
    start_time: Optional[str]
    end_time: Optional[str]
    bounds: Optional[Tuple[float, float, float, float]]
    sample: List[Point]
    points: Optional[List[Point]] = None


class WindedPoint(Point):
    wind_speed_10m_ms: Optional[float] = None
    wind_direction_10m_deg: Optional[float] = None  # meteorological (from)
    wind_u10_ms: Optional[float] = None             # eastward (+)
    wind_v10_ms: Optional[float] = None             # northward (+)


class WindForTrackRequest(BaseModel):
    points: List[Point]
    coord_strategy: Optional[str] = "centroid"      # "centroid" | "start" | "midpoint"
    source_preference: Optional[str] = "auto"       # "auto" | "era5" | "forecast"


class WindForTrackResult(BaseModel):
    source: str
    lat_used: float
    lon_used: float
    start_time: str
    end_time: str
    hourly_count: int
    mapped_count: int
    sample: List[WindedPoint]
    points: Optional[List[WindedPoint]] = None


# ---------------- Helpers ----------------
EARTH_RADIUS_M = 6_371_000.0

def _safe_float(x):
    try:
        return float(x)
    except Exception:
        return None

def _safe_int(x):
    try:
        return int(x)
    except Exception:
        return None

def _iso(dt):
    """
    Normalize datetime/date/ISO string to ISO-8601 UTC string.
    Returns None on failure.
    """
    if dt is None:
        return None
    if isinstance(dt, (datetime.datetime, datetime.date)):
        if isinstance(dt, datetime.datetime) and dt.tzinfo is None:
            dt = dt.replace(tzinfo=datetime.timezone.utc)
        return dt.astimezone(datetime.timezone.utc).isoformat()
    try:
        parsed = datetime.datetime.fromisoformat(str(dt).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=datetime.timezone.utc)
        return parsed.astimezone(datetime.timezone.utc).isoformat()
    except Exception:
        return None

def _to_dt(ts: str) -> Optional[datetime.datetime]:
    if not ts:
        return None
    try:
        dt = datetime.datetime.fromisoformat(ts.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=datetime.timezone.utc)
        return dt.astimezone(datetime.timezone.utc)
    except Exception:
        return None

def _haversine_m(lat1, lon1, lat2, lon2) -> float:
    if None in (lat1, lon1, lat2, lon2):
        return 0.0
    rlat1, rlon1, rlat2, rlon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = rlat2 - rlat1
    dlon = rlon2 - rlon1
    a = math.sin(dlat/2)**2 + math.cos(rlat1)*math.cos(rlat2)*math.sin(dlon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return EARTH_RADIUS_M * c

def _bounds(points: List[dict]):
    lats = [p["lat"] for p in points if p.get("lat") is not None]
    lons = [p["lon"] for p in points if p.get("lon") is not None]
    if not lats or not lons:
        return None
    return (min(lats), min(lons), max(lats), max(lons))

def _detect_file_type(filename: str, head: bytes) -> str:
    ext = (os.path.splitext(filename)[1] or "").lower()
    if ext in [".gpx", ".tcx", ".fit"]:
        return ext[1:]
    sniff = head[:2048].lstrip()
    if sniff.startswith(b"<"):
        if b"<gpx" in sniff[:200].lower():
            return "gpx"
        if b"trainingcenterdatabase" in sniff.lower() or b"<tcx" in sniff.lower():
            return "tcx"
        if b"<activities" in sniff.lower():
            return "tcx"
        return "gpx"
    if len(head) >= 12 and head[8:12] == b".FIT":
        return "fit"
    return "unknown"

def _semicircles_to_degrees(v):
    if v is None:
        return None
    return float(v) * 180.0 / (2**31)

# ----- Derived speed for GPS when missing -----
def derive_speeds(points: List[dict], max_reasonable_m_s: float = 30.0, *, per_point_debug: bool = False) -> int:
    """
    Fills missing speed_m_s using haversine/Δt.
    Returns the number of points for which speed was derived.
    """
    derived = 0
    prev_dt = prev_lat = prev_lon = None

    for idx, p in enumerate(points):
        if p.get("speed_m_s") is not None:
            dt = _to_dt(p.get("timestamp"))
            if dt and (p.get("lat") is not None) and (p.get("lon") is not None):
                prev_dt, prev_lat, prev_lon = dt, p["lat"], p["lon"]
            continue

        cur_dt = _to_dt(p.get("timestamp"))
        cur_lat = p.get("lat")
        cur_lon = p.get("lon")

        if prev_dt and cur_dt and (cur_lat is not None) and (cur_lon is not None) and (prev_lat is not None) and (prev_lon is not None):
            dt_s = (cur_dt - prev_dt).total_seconds()
            if dt_s > 0:
                dist_m = _haversine_m(prev_lat, prev_lon, cur_lat, cur_lon)
                v = dist_m / dt_s
                if v <= max_reasonable_m_s:
                    p["speed_m_s"] = v
                    derived += 1
                    if per_point_debug:
                        log.debug(f"[derive_speeds] idx={idx} v={v:.2f} m/s dist={dist_m:.1f} m dt={dt_s:.2f} s")

        if cur_dt and (cur_lat is not None) and (cur_lon is not None):
            prev_dt, prev_lat, prev_lon = cur_dt, cur_lat, cur_lon

    return derived

# ----- Wind vector helpers (meteorological to u/v and back) -----
def met_dir_deg_to_uv(ws_ms: float, wd_deg_from: float) -> Tuple[float, float]:
    """Convert meteorological direction (from) to u/v components."""
    if ws_ms is None or wd_deg_from is None:
        return (None, None)
    theta = math.radians(wd_deg_from)  # 0=N, 90=E
    u = -ws_ms * math.sin(theta)  # eastward
    v = -ws_ms * math.cos(theta)  # northward
    return (u, v)

def uv_to_met_dir_deg(u: float, v: float) -> Optional[float]:
    """Convert u/v to meteorological direction (from)."""
    if u is None or v is None:
        return None
    deg = math.degrees(math.atan2(-u, -v))
    if deg < 0:
        deg += 360.0
    return deg

def uv_speed(u: Optional[float], v: Optional[float]) -> Optional[float]:
    if u is None or v is None:
        return None
    return math.hypot(u, v)

# ----- Track window & representative coordinate -----
def _track_window(points: List[dict]) -> Tuple[datetime.datetime, datetime.datetime]:
    dts = [_to_dt(p.get("timestamp")) for p in points if p.get("timestamp")]
    dts = [d for d in dts if d is not None]
    if not dts:
        raise HTTPException(status_code=400, detail="No valid timestamps in points.")
    return (min(dts), max(dts))

def _representative_coord(points: List[dict], strategy: str="centroid") -> Tuple[float, float]:
    coords = [(p.get("lat"), p.get("lon")) for p in points if (p.get("lat") is not None and p.get("lon") is not None)]
    if not coords:
        raise HTTPException(status_code=400, detail="No valid lat/lon coordinates in points.")
    if strategy == "start":
        lat, lon = coords[0]
    elif strategy == "midpoint":
        lat, lon = coords[len(coords)//2]
    else:
        lats = sorted([c[0] for c in coords])
        lons = sorted([c[1] for c in coords])
        lat = lats[len(lats)//2]
        lon = lons[len(lons)//2]
    return float(lat), float(lon)


# ----- Open-Meteo fetchers (ERA5 + Forecast with auto fallback) -----
OPEN_METEO_ARCHIVE = "https://archive-api.open-meteo.com/v1/era5"
OPEN_METEO_FORECAST = "https://api.open-meteo.com/v1/forecast"

async def _fetch_openmeteo_era5_hourly(lat: float, lon: float,
                                       start_dt: datetime.datetime,
                                       end_dt: datetime.datetime) -> dict:
    params = {
        "latitude": f"{lat:.6f}",
        "longitude": f"{lon:.6f}",
        "start_date": start_dt.date().isoformat(),
        "end_date": end_dt.date().isoformat(),
        "hourly": "wind_speed_10m,wind_direction_10m",
        "wind_speed_unit": "ms",   # NOTE: underscore for ERA5
        "timeformat": "iso8601",
        "timezone": "UTC",
    }
    log.info(f"[Open-Meteo ERA5] {params}")
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(OPEN_METEO_ARCHIVE, params=params)
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"ERA5 error: {r.status_code} {r.text[:200]}")
    return r.json()

async def _fetch_openmeteo_forecast_hourly(lat: float, lon: float,
                                           start_dt: datetime.datetime,
                                           end_dt: datetime.datetime) -> dict:
    params = {
        "latitude": f"{lat:.6f}",
        "longitude": f"{lon:.6f}",
        "start_date": start_dt.date().isoformat(),
        "end_date": end_dt.date().isoformat(),
        "hourly": "wind_speed_10m,wind_direction_10m",
        "windspeed_unit": "ms",    # NOTE: no underscore for forecast
        "timeformat": "iso8601",
        "timezone": "UTC",
    }
    log.info(f"[Open-Meteo forecast] {params}")
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(OPEN_METEO_FORECAST, params=params)
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Forecast error: {r.status_code} {r.text[:200]}")
    return r.json()

def _build_hourly_uv_series(hourly: Dict) -> Tuple[List[datetime.datetime], List[float], List[float]]:
    times = hourly.get("time", [])
    spds = hourly.get("wind_speed_10m", [])
    dirs = hourly.get("wind_direction_10m", [])
    if not times or not spds or not dirs or len(times) != len(spds) or len(times) != len(dirs):
        raise HTTPException(status_code=502, detail="Open-Meteo hourly arrays inconsistent.")
    tvec, uvec, vvec = [], [], []
    for t, s, d in zip(times, spds, dirs):
        dt = _to_dt(t)
        if dt is None:
            continue
        ws = _safe_float(s)
        wd = _safe_float(d)
        if ws is None or wd is None:
            continue
        u, v = met_dir_deg_to_uv(ws, wd)
        if u is None or v is None:
            continue
        tvec.append(dt)
        uvec.append(u)
        vvec.append(v)
    if not tvec:
        raise HTTPException(status_code=502, detail="Open-Meteo hourly series empty after parsing.")
    return tvec, uvec, vvec

async def fetch_openmeteo_hourly_auto(lat: float, lon: float,
                                      start_dt: datetime.datetime,
                                      end_dt: datetime.datetime,
                                      source_pref: str = "auto"):
    """
    Returns (source_used, times_dt_list, u_list, v_list)
    Tries ERA5 first unless source_pref forces forecast.
    Falls back to forecast if ERA5 returns empty/invalid.
    """
    async def try_build(fetch_fn, tag: str):
        try:
            data = await fetch_fn(lat, lon, start_dt, end_dt)
            hourly = data.get("hourly", {})
            tvec, uvec, vvec = _build_hourly_uv_series(hourly)
            return (tag, tvec, uvec, vvec)
        except HTTPException as e:
            log.warning(f"[{tag}] unusable hourly data: {e.detail}")
            return None

    if source_pref == "era5":
        res = await try_build(_fetch_openmeteo_era5_hourly, "era5")
        if not res:
            raise HTTPException(status_code=502, detail="ERA5 had no usable hourly data for this window.")
        return res

    if source_pref == "forecast":
        res = await try_build(_fetch_openmeteo_forecast_hourly, "forecast")
        if not res:
            raise HTTPException(status_code=502, detail="Forecast API had no usable hourly data for this window.")
        return res

    # auto: prefer ERA5, then fallback to forecast
    res = await try_build(_fetch_openmeteo_era5_hourly, "era5")
    if res:
        return res
    res = await try_build(_fetch_openmeteo_forecast_hourly, "forecast")
    if res:
        return res

    raise HTTPException(status_code=502, detail="Open-Meteo returned no usable hourly data for this window.")


def _interp_uv_at(ts: datetime.datetime, times: List[datetime.datetime], u: List[float], v: List[float]) -> Tuple[float, float]:
    """Piecewise-linear interpolation on u and v vs time."""
    idx = bisect.bisect_left(times, ts)
    if idx <= 0:
        return u[0], v[0]
    if idx >= len(times):
        return u[-1], v[-1]
    t0, t1 = times[idx-1], times[idx]
    u0, u1 = u[idx-1], u[idx]
    v0, v1 = v[idx-1], v[idx]
    span = (t1 - t0).total_seconds()
    if span <= 0:
        return u0, v0
    frac = (ts - t0).total_seconds() / span
    ui = u0 + frac * (u1 - u0)
    vi = v0 + frac * (v1 - v0)
    return ui, vi

def _map_wind_to_points(points: List[dict], times: List[datetime.datetime], u: List[float], v: List[float]) -> List[dict]:
    out = []
    mapped = 0
    for p in points:
        ts = _to_dt(p.get("timestamp"))
        if ts is None:
            out.append({**p,
                        "wind_speed_10m_ms": None,
                        "wind_direction_10m_deg": None,
                        "wind_u10_ms": None,
                        "wind_v10_ms": None})
            continue
        ui, vi = _interp_uv_at(ts, times, u, v)
        ws = uv_speed(ui, vi)
        wd = uv_to_met_dir_deg(ui, vi)
        mapped += 1
        out.append({**p,
                    "wind_speed_10m_ms": ws,
                    "wind_direction_10m_deg": wd,
                    "wind_u10_ms": ui,
                    "wind_v10_ms": vi})
    log.info(f"Wind mapping complete: {mapped} / {len(points)} timestamps matched via interpolation")
    return out


# ---------------- Parsers ----------------
def parse_gpx(data: bytes) -> List[dict]:
    text = data.decode("utf-8", errors="ignore")
    gpx = gpxpy.parse(text)
    out: List[dict] = []
    for track in gpx.tracks:
        for seg in track.segments:
            for p in seg.points:
                out.append({
                    "timestamp": _iso(p.time) if p.time else None,
                    "lat": p.latitude,
                    "lon": p.longitude,
                    "altitude_m": p.elevation,
                    "speed_m_s": None,
                    "heart_rate_bpm": None,
                    "cadence_rpm": None,
                })
    # Try Garmin TrackPointExtension speed if present
    try:
        root = etree.fromstring(text.encode())
        ns = {"gpxtpx": "http://www.garmin.com/xmlschemas/TrackPointExtension/v1"}
        spds = root.findall(".//gpxtpx:TrackPointExtension/gpxtpx:speed", namespaces=ns)
        for i, s in enumerate(spds):
            if i < len(out):
                val = _safe_float(s.text)
                if val is not None:
                    out[i]["speed_m_s"] = val
    except Exception:
        pass
    return out

def parse_tcx(data: bytes) -> List[dict]:
    ns = {
        "tcx": "http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2",
        "ns3": "http://www.garmin.com/xmlschemas/ActivityExtension/v2",
    }
    root = etree.fromstring(data)
    points: List[dict] = []
    for tp in root.findall(".//tcx:Trackpoint", namespaces=ns):
        t = tp.findtext("tcx:Time", namespaces=ns)
        lat = tp.findtext("tcx:Position/tcx:LatitudeDegrees", namespaces=ns)
        lon = tp.findtext("tcx:Position/tcx:LongitudeDegrees", namespaces=ns)
        alt = tp.findtext("tcx:AltitudeMeters", namespaces=ns)
        hr = tp.findtext("tcx:HeartRateBpm/tcx:Value", namespaces=ns)
        cad = tp.findtext("tcx:Cadence", namespaces=ns)
        spd_node = tp.find("tcx:Extensions/ns3:TPX/ns3:Speed", namespaces=ns)
        spd = spd_node.text if spd_node is not None else None
        points.append({
            "timestamp": _iso(t),
            "lat": _safe_float(lat),
            "lon": _safe_float(lon),
            "altitude_m": _safe_float(alt),
            "speed_m_s": _safe_float(spd),
            "heart_rate_bpm": _safe_int(hr),
            "cadence_rpm": _safe_int(cad),
        })
    return points

def parse_fit(data: bytes) -> List[dict]:
    out: List[dict] = []
    with fitdecode.FitReader(io.BytesIO(data)) as fr:
        for frame in fr:
            if isinstance(frame, fitdecode.records.FitDataMessage) and frame.name == "record":
                f = frame.get_values()
                ts = f.get("timestamp")
                lat = f.get("position_lat")
                lon = f.get("position_long")
                alt = f.get("altitude")
                spd = f.get("speed")
                hr = f.get("heart_rate")
                cad = f.get("cadence")
                out.append({
                    "timestamp": _iso(ts),
                    "lat": _semicircles_to_degrees(lat) if lat is not None else None,
                    "lon": _semicircles_to_degrees(lon) if lon is not None else None,
                    "altitude_m": _safe_float(alt),
                    "speed_m_s": _safe_float(spd),
                    "heart_rate_bpm": _safe_int(hr),
                    "cadence_rpm": _safe_int(cad),
                })
    return out

def build_summary(file_type: str, points: List[dict]) -> ParseResult:
    pts = sorted(points, key=lambda p: (p["timestamp"] or ""))
    start = next((p["timestamp"] for p in pts if p["timestamp"]), None)
    end   = next((p["timestamp"] for p in reversed(pts) if p["timestamp"]), None)
    return ParseResult(
        file_type=file_type,
        num_points=len(pts),
        start_time=start,
        end_time=end,
        bounds=_bounds(pts),
        sample=[Point(**p) for p in pts[:5]],
        points=None,
    )


# ---------------- API: parse GPS ----------------
@app.post("/parse-gps", response_model=ParseResult)
async def parse_gps(file: UploadFile = File(...), return_full: bool = False):
    head = await file.read(4096)
    file_type = _detect_file_type(file.filename or "upload", head)
    log.info(f"Received file={file.filename}, detected_type={file_type}")
    if file_type == "unknown":
        raise HTTPException(status_code=400, detail="Could not detect file type (gpx/tcx/fit).")

    await file.seek(0)
    data = await file.read()
    log.info(f"Read {len(data)} bytes")

    try:
        if file_type == "gpx":
            log.info("Parsing GPX...")
            points = parse_gpx(data)
        elif file_type == "tcx":
            log.info("Parsing TCX...")
            points = parse_tcx(data)
        elif file_type == "fit":
            log.info("Parsing FIT...")
            points = parse_fit(data)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type.")
        log.info(f"Parsed {len(points)} points")

        derived_count = derive_speeds(points, per_point_debug=False)
        log.info(f"Speed derivation: {'YES' if derived_count else 'NO'} ({derived_count} of {len(points)} points)")

    except Exception as e:
        log.exception("Parsing failed")
        raise HTTPException(status_code=422, detail=f"Parsing failed: {e}")

    out = build_summary(file_type, points)
    if return_full:
        out.points = [Point(**p) for p in points]
    return out


# ---------------- API: wind for track ----------------
@app.post("/wind-for-track", response_model=WindForTrackResult)
async def wind_for_track(req: WindForTrackRequest, return_full: bool = False):
    if not req.points:
        raise HTTPException(status_code=400, detail="No points provided.")

    start_dt, end_dt = _track_window([p.dict() for p in req.points])
    lat, lon = _representative_coord([p.dict() for p in req.points], strategy=(req.coord_strategy or "centroid"))

    log.info(f"Wind fetch: lat={lat:.5f}, lon={lon:.5f}, window={start_dt.isoformat()}..{end_dt.isoformat()} (UTC)")

    source_used, times, u, v = await fetch_openmeteo_hourly_auto(
        lat, lon, start_dt, end_dt, req.source_preference or "auto"
    )

    mapped = _map_wind_to_points([p.dict() for p in req.points], times, u, v)

    res = WindForTrackResult(
        source=source_used,
        lat_used=lat,
        lon_used=lon,
        start_time=start_dt.isoformat(),
        end_time=end_dt.isoformat(),
        hourly_count=len(times),
        mapped_count=len(mapped),
        sample=[WindedPoint(**mapped[i]) for i in range(min(5, len(mapped)))],
        points=[WindedPoint(**p) for p in mapped] if return_full else None
    )
    return res


@app.get("/health")
def health():
    return {"status": "ok"}


# Allow `python backend/app.py` to run directly if desired
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
