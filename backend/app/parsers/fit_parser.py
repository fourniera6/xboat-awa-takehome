from fitparse import FitFile
from datetime import timezone

# returns list of {t, lat, lon, speed, heading}

def parse_fit_bytes(data: bytes):
    f = FitFile(data)
    pts = []
    for m in f.get_messages("record"):
        d = {}
        for f0 in m:
            d[f0.name] = f0.value
        if not ("position_lat" in d and "position_long" in d and "timestamp" in d):
            continue
        lat = d["position_lat"] * (180/2**31)
        lon = d["position_long"] * (180/2**31)
        t = d["timestamp"].astimezone(timezone.utc).isoformat().replace("+00:00","Z")
        spd = float(d.get("speed")) if d.get("speed") is not None else None
        hdg = float(d.get("heading")) if d.get("heading") is not None else None
        pts.append({"t": t, "lat": lat, "lon": lon, "speed": spd, "heading": hdg})
    # fill forward
    fill_forward(pts, "speed", 0.0)
    fill_forward(pts, "heading", 0.0)
    return pts

def fill_forward(arr, key, default):
    last = default
    for a in arr:
        if a[key] is None:
            a[key] = last
        else:
            last = a[key]
