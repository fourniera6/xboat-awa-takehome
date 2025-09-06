import math, logging, datetime
from typing import List, Tuple, Optional
from app.services.wind import uv_to_met_dir_deg, uv_speed
from app.services import parsing as P

log = logging.getLogger("xboat-api")

def _bearing_deg(lat1, lon1, lat2, lon2) -> Optional[float]:
    """Initial bearing (deg, 0=N, clockwise). Returns None if points identical/missing."""
    if None in (lat1, lon1, lat2, lon2):
        return None
    if abs(lat1 - lat2) < 1e-12 and abs(lon1 - lon2) < 1e-12:
        return None
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    Δλ = math.radians(lon2 - lon1)
    y = math.sin(Δλ) * math.cos(φ2)
    x = math.cos(φ1) * math.sin(φ2) - math.sin(φ1) * math.cos(φ2) * math.cos(Δλ)
    θ = math.degrees(math.atan2(y, x))
    if θ < 0: θ += 360.0
    return θ

def _wrap180(deg: float) -> float:
    return ((deg + 180.0) % 360.0) - 180.0

def compute_course(points: List[dict]) -> List[Optional[float]]:
    """Course over ground for each point using previous valid point."""
    course = [None] * len(points)
    prev_idx = None
    for i, p in enumerate(points):
        lat, lon = p.get("lat"), p.get("lon")
        if lat is None or lon is None:
            continue
        if prev_idx is not None:
            plat, plon = points[prev_idx].get("lat"), points[prev_idx].get("lon")
            crs = _bearing_deg(plat, plon, lat, lon)
            course[i] = crs
        prev_idx = i
    return course

def compute_boat_uv(points: List[dict], course_deg: List[Optional[float]]) -> List[Tuple[Optional[float], Optional[float]]]:
    """Boat velocity components from speed and course; (u_east, v_north)."""
    out = []
    for p, crs in zip(points, course_deg):
        s = p.get("speed_m_s")
        if s is None or crs is None:
            out.append((None, None))
            continue
        th = math.radians(crs)
        # Direction of motion is "to": east component = s*sin, north = s*cos
        u_b = s * math.sin(th)
        v_b = s * math.cos(th)
        out.append((u_b, v_b))
    return out

def apparent_from_true(points: List[dict], *, min_speed_ms: float = 0.5) -> List[dict]:
    # Ensure speed is filled where possible
    P.derive_speeds(points)

    course = compute_course(points)
    boat_uv = compute_boat_uv(points, course)

    out = []
    mapped = 0
    for p, crs, (ub, vb) in zip(points, course, boat_uv):
        wu, wv = p.get("wind_u10_ms"), p.get("wind_v10_ms")
        row = dict(p)
        row["course_deg"] = crs
        row["boat_u_ms"] = ub
        row["boat_v_ms"] = vb

        if wu is None or wv is None:
            row.update({"apparent_wind_speed_ms": None, "apparent_wind_dir_deg": None, "awa_deg": None})
            out.append(row); continue

        au = wu - (ub if ub is not None else 0.0)
        av = wv - (vb if vb is not None else 0.0)
        aspd = uv_speed(au, av)
        adir = uv_to_met_dir_deg(au, av)

        awa = None
        if crs is not None and adir is not None and (p.get("speed_m_s") or 0.0) >= min_speed_ms:
            awa = _wrap180(adir - crs)

        row.update({
            "apparent_wind_speed_ms": aspd,
            "apparent_wind_dir_deg": adir,
            "awa_deg": awa
        })
        mapped += 1
        out.append(row)

    log.info(f"Apparent wind computed for {mapped} / {len(points)} points (min_speed_ms={min_speed_ms})")
    return out


def track_window(points: List[dict]):
    dts = [P.to_dt(p.get("timestamp")) for p in points if p.get("timestamp")]
    dts = [d for d in dts if d is not None]
    if not dts:
        raise ValueError("No valid timestamps in points.")
    return min(dts), max(dts)

def representative_coord(points: List[dict], strategy: str="centroid"):
    coords = [(p.get("lat"), p.get("lon")) for p in points if p.get("lat") is not None and p.get("lon") is not None]
    if not coords:
        raise ValueError("No valid lat/lon in points.")
    if strategy == "start":
        lat, lon = coords[0]
    elif strategy == "midpoint":
        lat, lon = coords[len(coords)//2]
    else:
        lats = sorted([c[0] for c in coords]); lons = sorted([c[1] for c in coords])
        lat, lon = lats[len(lats)//2], lons[len(lons)//2]
    return float(lat), float(lon)
