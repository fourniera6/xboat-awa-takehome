import io, os, math, datetime, logging
from typing import List, Optional, Tuple
import gpxpy, gpxpy.gpx
from lxml import etree
import fitdecode

log = logging.getLogger("xboat-api")
EARTH_RADIUS_M = 6_371_000.0

def _safe_float(x):
    try: return float(x)
    except Exception: return None

def _safe_int(x):
    try: return int(x)
    except Exception: return None

def _iso(dt):
    if dt is None: return None
    if isinstance(dt, (datetime.datetime, datetime.date)):
        if isinstance(dt, datetime.datetime) and dt.tzinfo is None:
            dt = dt.replace(tzinfo=datetime.timezone.utc)
        return dt.astimezone(datetime.timezone.utc).isoformat()
    try:
        p = datetime.datetime.fromisoformat(str(dt).replace("Z","+00:00"))
        if p.tzinfo is None: p = p.replace(tzinfo=datetime.timezone.utc)
        return p.astimezone(datetime.timezone.utc).isoformat()
    except Exception:
        return None

def _to_dt(ts: str) -> Optional[datetime.datetime]:
    if not ts: return None
    try:
        dt = datetime.datetime.fromisoformat(ts.replace("Z","+00:00"))
        if dt.tzinfo is None: dt = dt.replace(tzinfo=datetime.timezone.utc)
        return dt.astimezone(datetime.timezone.utc)
    except Exception:
        return None

def _haversine_m(lat1, lon1, lat2, lon2) -> float:
    if None in (lat1, lon1, lat2, lon2): return 0.0
    rlat1, rlon1, rlat2, rlon2 = map(math.radians,[lat1,lon1,lat2,lon2])
    dlat, dlon = rlat2-rlat1, rlon2-rlon1
    a = math.sin(dlat/2)**2 + math.cos(rlat1)*math.cos(rlat2)*math.sin(dlon/2)**2
    return EARTH_RADIUS_M * 2*math.atan2(math.sqrt(a), math.sqrt(1-a))

def _bounds(points: List[dict]):
    lats = [p["lat"] for p in points if p.get("lat") is not None]
    lons = [p["lon"] for p in points if p.get("lon") is not None]
    return None if not lats or not lons else (min(lats), min(lons), max(lats), max(lons))

def _semicircles_to_degrees(v):
    return None if v is None else float(v) * 180.0 / (2**31)

def detect_file_type(filename: str, head: bytes) -> str:
    ext = (os.path.splitext(filename)[1] or "").lower()
    if ext in [".gpx",".tcx",".fit"]: return ext[1:]
    sniff = head[:2048].lstrip()
    if len(head) >= 12 and head[8:12] == b".FIT": return "fit"
    if sniff.startswith(b"<"):
        if b"<gpx" in sniff[:200].lower(): return "gpx"
        if b"trainingcenterdatabase" in sniff.lower() or b"<tcx" in sniff.lower() or b"<activities" in sniff.lower():
            return "tcx"
        return "gpx"
    return "unknown"

def parse_gpx(data: bytes) -> List[dict]:
    text = data.decode("utf-8", errors="ignore")
    gpx = gpxpy.parse(text)
    out = []
    for trk in gpx.tracks:
        for seg in trk.segments:
            for p in seg.points:
                out.append({
                    "timestamp": _iso(p.time) if p.time else None,
                    "lat": p.latitude, "lon": p.longitude,
                    "altitude_m": p.elevation, "speed_m_s": None,
                    "heart_rate_bpm": None, "cadence_rpm": None,
                })
    # Garmin TrackPointExtension speed (optional)
    try:
        root = etree.fromstring(text.encode())
        ns = {"gpxtpx": "http://www.garmin.com/xmlschemas/TrackPointExtension/v1"}
        spds = root.findall(".//gpxtpx:TrackPointExtension/gpxtpx:speed", namespaces=ns)
        for i, s in enumerate(spds):
            if i < len(out):
                val = _safe_float(s.text)
                if val is not None: out[i]["speed_m_s"] = val
    except Exception:
        pass
    return out

def parse_tcx(data: bytes) -> List[dict]:
    ns = {
        "tcx":"http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2",
        "ns3":"http://www.garmin.com/xmlschemas/ActivityExtension/v2",
    }
    root = etree.fromstring(data)
    points = []
    for tp in root.findall(".//tcx:Trackpoint", namespaces=ns):
        t   = tp.findtext("tcx:Time", namespaces=ns)
        lat = tp.findtext("tcx:Position/tcx:LatitudeDegrees", namespaces=ns)
        lon = tp.findtext("tcx:Position/tcx:LongitudeDegrees", namespaces=ns)
        alt = tp.findtext("tcx:AltitudeMeters", namespaces=ns)
        hr  = tp.findtext("tcx:HeartRateBpm/tcx:Value", namespaces=ns)
        cad = tp.findtext("tcx:Cadence", namespaces=ns)
        spd_node = tp.find("tcx:Extensions/ns3:TPX/ns3:Speed", namespaces=ns)
        spd = spd_node.text if spd_node is not None else None
        points.append({
            "timestamp": _iso(t),
            "lat": _safe_float(lat), "lon": _safe_float(lon),
            "altitude_m": _safe_float(alt), "speed_m_s": _safe_float(spd),
            "heart_rate_bpm": _safe_int(hr), "cadence_rpm": _safe_int(cad),
        })
    return points

def parse_fit(data: bytes) -> List[dict]:
    out = []
    with fitdecode.FitReader(io.BytesIO(data)) as fr:
        for frame in fr:
            if frame.__class__.__name__ == "FitDataMessage" and frame.name == "record":
                f = frame.get_values()
                out.append({
                    "timestamp": _iso(f.get("timestamp")),
                    "lat": _semicircles_to_degrees(f.get("position_lat")),
                    "lon": _semicircles_to_degrees(f.get("position_long")),
                    "altitude_m": _safe_float(f.get("altitude")),
                    "speed_m_s": _safe_float(f.get("speed")),
                    "heart_rate_bpm": _safe_int(f.get("heart_rate")),
                    "cadence_rpm": _safe_int(f.get("cadence")),
                })
    return out

def derive_speeds(points: List[dict], max_reasonable_m_s: float = 30.0, *, per_point_debug=False) -> int:
    derived = 0
    prev_dt = prev_lat = prev_lon = None
    for idx, p in enumerate(points):
        if p.get("speed_m_s") is not None:
            dt = _to_dt(p.get("timestamp"))
            if dt and (p.get("lat") is not None) and (p.get("lon") is not None):
                prev_dt, prev_lat, prev_lon = dt, p["lat"], p["lon"]
            continue
        cur_dt = _to_dt(p.get("timestamp")); cur_lat = p.get("lat"); cur_lon = p.get("lon")
        if prev_dt and cur_dt and (cur_lat is not None) and (cur_lon is not None) and (prev_lat is not None) and (prev_lon is not None):
            dt_s = (cur_dt - prev_dt).total_seconds()
            if dt_s > 0:
                v = _haversine_m(prev_lat, prev_lon, cur_lat, cur_lon) / dt_s
                if v <= max_reasonable_m_s:
                    p["speed_m_s"] = v; derived += 1
                    if per_point_debug:
                        log.debug(f"[derive_speeds] idx={idx} v={v:.2f} m/s")
        if cur_dt and (cur_lat is not None) and (cur_lon is not None):
            prev_dt, prev_lat, prev_lon = cur_dt, cur_lat, cur_lon
    return derived

def bounds(points: List[dict]): return _bounds(points)
def to_dt(ts: str): return _to_dt(ts)
