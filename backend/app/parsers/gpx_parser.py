import gpxpy
from datetime import timezone, datetime
from ..utils.geo import haversine_m, initial_bearing_deg

# returns [{t, lat, lon, speed, heading}]

def parse_gpx_bytes(data: bytes):
    gpx = gpxpy.parse(data.decode("utf-8", errors="ignore"))
    pts = []
    for trk in gpx.tracks:
        for seg in trk.segments:
            for p in seg.points:
                if not p.time:
                    continue
                pts.append({
                    "t": p.time.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
                    "lat": p.latitude,
                    "lon": p.longitude,
                    "speed": None,
                    "heading": None,
                })
    # derive speed/heading
    for i in range(1, len(pts)):
        p0, p1 = pts[i-1], pts[i]
        dt = (from_iso(p1["t"]) - from_iso(p0["t"])) .total_seconds()
        if dt <= 0: 
            continue
        d = haversine_m(p0["lat"], p0["lon"], p1["lat"], p1["lon"])
        spd = d / dt
        brg = initial_bearing_deg(p0["lat"], p0["lon"], p1["lat"], p1["lon"])
        pts[i]["speed"] = spd
        pts[i]["heading"] = brg
    # carry forward last known
    fill_forward(pts, key="speed", default=0.0)
    fill_forward(pts, key="heading", default=0.0)
    return pts

def from_iso(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))

def fill_forward(arr, key, default):
    last = default
    for a in arr:
        if a[key] is None:
            a[key] = last
        else:
            last = a[key]
