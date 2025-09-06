from lxml import etree
from datetime import datetime, timezone
from ..utils.geo import haversine_m, initial_bearing_deg

# minimal TCX Trackpoint parser

def parse_tcx_bytes(data: bytes):
    root = etree.fromstring(data)
    ns = {"tcx": "http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"}
    points = []
    for tp in root.xpath(".//tcx:Trackpoint", namespaces=ns):
        tnode = tp.find("tcx:Time", namespaces=ns)
        pnode = tp.find("tcx:Position", namespaces=ns)
        if tnode is None or pnode is None:
            continue
        lat = float(pnode.findtext("tcx:LatitudeDegrees", namespaces=ns))
        lon = float(pnode.findtext("tcx:LongitudeDegrees", namespaces=ns))
        t = datetime.fromisoformat(tnode.text.replace("Z", "+00:00")).astimezone(timezone.utc)
        spd = tp.findtext("tcx:Extensions//ns3:Speed", namespaces={"ns3":"http://www.garmin.com/xmlschemas/ActivityExtension/v2"})
        spd = float(spd) if spd is not None else None
        points.append({"t": t.isoformat().replace("+00:00","Z"), "lat": lat, "lon": lon, "speed": spd, "heading": None})
    # derive heading/speed if missing
    for i in range(1, len(points)):
        p0, p1 = points[i-1], points[i]
        dt = (from_iso(p1["t"]) - from_iso(p0["t"])) .total_seconds()
        if dt <= 0: 
            continue
        d = haversine_m(p0["lat"], p0["lon"], p1["lat"], p1["lon"])
        if points[i]["speed"] is None:
            points[i]["speed"] = d / dt
        points[i]["heading"] = initial_bearing_deg(p0["lat"], p0["lon"], p1["lat"], p1["lon"])
    fill_forward(points, "speed", 0.0)
    fill_forward(points, "heading", 0.0)
    return points

def from_iso(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))

def fill_forward(arr, key, default):
    last = default
    for a in arr:
        if a[key] is None:
            a[key] = last
        else:
            last = a[key]
