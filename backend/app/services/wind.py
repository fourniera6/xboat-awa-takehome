import math, bisect, logging, datetime
from typing import Dict, List, Tuple
import httpx
from app.core.config import settings

log = logging.getLogger("xboat-api")

OPEN_METEO_ARCHIVE  = "https://archive-api.open-meteo.com/v1/era5"
OPEN_METEO_FORECAST = "https://api.open-meteo.com/v1/forecast"

def _to_dt(ts: str):
    if not ts: return None
    try:
        dt = datetime.datetime.fromisoformat(str(ts).replace("Z","+00:00"))
        if dt.tzinfo is None: dt = dt.replace(tzinfo=datetime.timezone.utc)
        return dt.astimezone(datetime.timezone.utc)
    except Exception:
        return None

def met_dir_deg_to_uv(ws_ms: float, wd_deg_from: float) -> Tuple[float,float]:
    if ws_ms is None or wd_deg_from is None: return (None, None)
    th = math.radians(wd_deg_from)
    return (-ws_ms*math.sin(th), -ws_ms*math.cos(th))  # (u, v)

def uv_to_met_dir_deg(u: float, v: float):
    if u is None or v is None: return None
    deg = math.degrees(math.atan2(-u, -v))
    return deg + 360 if deg < 0 else deg

def uv_speed(u: float, v: float):
    if u is None or v is None: return None
    return math.hypot(u, v)

async def _era5(lat: float, lon: float, start_dt, end_dt) -> dict:
    params = {
        "latitude": f"{lat:.6f}", "longitude": f"{lon:.6f}",
        "start_date": start_dt.date().isoformat(), "end_date": end_dt.date().isoformat(),
        "hourly": "wind_speed_10m,wind_direction_10m",
        "wind_speed_unit": "ms", "timeformat": "iso8601", "timezone": "UTC",
    }
    log.info(f"[Open-Meteo ERA5] {params}")
    async with httpx.AsyncClient(timeout=settings.OPENMETEO_TIMEOUT_S) as client:
        r = await client.get(OPEN_METEO_ARCHIVE, params=params)
    r.raise_for_status()
    return r.json()

async def _forecast(lat: float, lon: float, start_dt, end_dt) -> dict:
    params = {
        "latitude": f"{lat:.6f}", "longitude": f"{lon:.6f}",
        "start_date": start_dt.date().isoformat(), "end_date": end_dt.date().isoformat(),
        "hourly": "wind_speed_10m,wind_direction_10m",
        "windspeed_unit": "ms", "timeformat": "iso8601", "timezone": "UTC",
    }
    log.info(f"[Open-Meteo forecast] {params}")
    async with httpx.AsyncClient(timeout=settings.OPENMETEO_TIMEOUT_S) as client:
        r = await client.get(OPEN_METEO_FORECAST, params=params)
    r.raise_for_status()
    return r.json()

def _build_uv(hourly: Dict):
    times = hourly.get("time", []); spd = hourly.get("wind_speed_10m", []); direc = hourly.get("wind_direction_10m", [])
    if not times or not spd or not direc or len(times)!=len(spd) or len(times)!=len(direc):
        raise ValueError("Open-Meteo hourly arrays inconsistent.")
    tvec,uvec,vvec = [],[],[]
    for t,s,d in zip(times, spd, direc):
        dt = _to_dt(t); 
        if dt is None: continue
        ws = float(s); wd = float(d)
        u,v = met_dir_deg_to_uv(ws, wd)
        tvec.append(dt); uvec.append(u); vvec.append(v)
    if not tvec: raise ValueError("Open-Meteo hourly series empty after parsing.")
    return tvec,uvec,vvec

async def fetch_openmeteo_hourly_auto(lat: float, lon: float, start_dt, end_dt, pref: str="auto"):
    async def try_source(fn, tag):
        try:
            data = await fn(lat, lon, start_dt, end_dt)
            t,u,v = _build_uv(data.get("hourly", {}))
            return (tag,t,u,v)
        except Exception as e:
            log.warning(f"[{tag}] unusable hourly: {e}")
            return None

    if pref == "era5":
        res = await try_source(_era5, "era5");  assert res, "ERA5 unusable"
        return res
    if pref == "forecast":
        res = await try_source(_forecast, "forecast"); assert res, "Forecast unusable"
        return res

    # auto: prefer ERA5, fallback forecast
    res = await try_source(_era5, "era5")
    if res: return res
    res = await try_source(_forecast, "forecast")
    if res: return res
    raise RuntimeError("Open-Meteo returned no usable hourly data.")

def interp_uv_at(ts, times, u, v):
    idx = bisect.bisect_left(times, ts)
    if idx <= 0: return u[0], v[0]
    if idx >= len(times): return u[-1], v[-1]
    t0,t1 = times[idx-1], times[idx]; u0,u1 = u[idx-1], u[idx]; v0,v1 = v[idx-1], v[idx]
    span = (t1-t0).total_seconds()
    if span <= 0: return u0, v0
    f = (ts - t0).total_seconds()/span
    return u0 + f*(u1-u0), v0 + f*(v1-v0)

def map_wind(points: List[dict], times, u, v):
    out, mapped = [], 0
    for p in points:
        ts = _to_dt(p.get("timestamp"))
        if ts is None:
            out.append({**p, "wind_speed_10m_ms": None, "wind_direction_10m_deg": None, "wind_u10_ms": None, "wind_v10_ms": None})
            continue
        ui,vi = interp_uv_at(ts, times, u, v)
        ws = uv_speed(ui, vi); wd = uv_to_met_dir_deg(ui, vi)
        mapped += 1
        out.append({**p, "wind_speed_10m_ms": ws, "wind_direction_10m_deg": wd, "wind_u10_ms": ui, "wind_v10_ms": vi})
    log.info(f"Wind mapping complete: {mapped} / {len(points)} timestamps")
    return out
