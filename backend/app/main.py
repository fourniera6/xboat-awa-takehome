from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict
from datetime import datetime, timezone
from .models import Summary
from .parsers.gpx_parser import parse_gpx_bytes
from .parsers.tcx_parser import parse_tcx_bytes
from .parsers.fit_parser import parse_fit_bytes
from .utils.bins import bin_latlon
from .utils.interp import interp_dir
from .metrics.apparent import apparent_from, adjusted_speed
from .wind.open_meteo import fetch_hourly

app = FastAPI(title="XBoat Wind App API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

DB: Dict[str, Dict] = {}

@app.get("/api/ping")
def ping():
    return {"ok": True}

@app.post("/api/upload")
async def upload(file: UploadFile = File(...)):
    ext = (file.filename.split(".")[-1] or "").lower()
    raw = await file.read()
    if ext == "gpx":
        pts = parse_gpx_bytes(raw)
    elif ext == "tcx":
        pts = parse_tcx_bytes(raw)
    elif ext == "fit":
        pts = parse_fit_bytes(raw)
    else:
        raise HTTPException(400, "Unsupported file type")
    if len(pts) < 2:
        raise HTTPException(400, "No points parsed")
    tid = f"trk_{len(DB)+1}"
    DB[tid] = {"series": pts}
    return {"track_id": tid, "count": len(pts)}

@app.post("/api/tracks/{tid}/process")
async def process_track(tid: str):
    if tid not in DB:
        raise HTTPException(404, "track not found")
    pts = DB[tid]["series"]
    # time bounds
    t0 = datetime.fromisoformat(pts[0]["t"].replace("Z","+00:00")).date()
    t1 = datetime.fromisoformat(pts[-1]["t"].replace("Z","+00:00")).date()
    start_date, end_date = t0.isoformat(), t1.isoformat()
    # spatial bins for multi-coordinate fetch
    bins = {}
    for p in pts:
        bins.setdefault(bin_latlon(p["lat"], p["lon"]), True)
    coords = list(bins.keys())
    # forecast vs archive heuristic (<= 90d → forecast)
    today = datetime.now(timezone.utc).date()
    age = (today - t1).days
    use_archive = age > 90
    met = await fetch_hourly(coords, start_date, end_date, use_archive=use_archive)

    # Build per-bin time → ws/wd table
    times = [datetime.fromisoformat(t.replace("Z","+00:00")) for t in met["hourly"]["time"]]
    table = {}
    for i, b in enumerate(coords):
        ws = met["hourly"]["wind_speed_10m"][i]
        wd = met["hourly"]["wind_direction_10m"][i]
        table[b] = {"times": times, "ws": ws, "wd": wd}

    # Interpolate per point
    aw = []
    import bisect
    for p in pts:
        b = bin_latlon(p["lat"], p["lon"])
        row = table[b]
        t = datetime.fromisoformat(p["t"].replace("Z","+00:00"))
        ts = row["times"]
        j = max(1, bisect.bisect_left(ts, t))
        j = min(j, len(ts)-1)
        t0h, t1h = ts[j-1], ts[j]
        w = (t - t0h).total_seconds() / max(1, (t1h - t0h).total_seconds())
        ws = row["ws"][j-1] + (row["ws"][j] - row["ws"][j-1]) * w
        wd = interp_dir(t0h.timestamp(), t1h.timestamp(), row["wd"][j-1], row["wd"][j], t.timestamp())
        aws, awa, head, cross = apparent_from(p["heading"], p["speed"], ws, wd)
        aw.append({"t": p["t"], "aws": aws, "awa": awa, "head": head, "cross": cross})

    DB[tid]["aw"] = aw

    # Summary
    dur = (datetime.fromisoformat(pts[-1]["t"].replace("Z","+00:00")) - datetime.fromisoformat(pts[0]["t"].replace("Z","+00:00"))).total_seconds()
    head_pos = sum(1 for x in aw if x["head"] > 0)
    tail_pos = sum(1 for x in aw if x["head"] < 0)
    cross_pos = sum(1 for x in aw if abs(x["cross"]) > abs(x["head"]))  # coarse proxy
    median_aws = sorted(x["aws"] for x in aw)[len(aw)//2]
    # headwind‑equivalent distance: integrate positive head component over time
    hed = 0.0
    for i in range(1,len(aw)):
        dt = (datetime.fromisoformat(aw[i]["t"].replace("Z","+00:00")) - datetime.fromisoformat(aw[i-1]["t"].replace("Z","+00:00"))).total_seconds()
        hed += max(0.0, (aw[i]["head"]+aw[i-1]["head"]) * 0.5) * dt
    # crude adjusted average split over whole session
    spds = [p["speed"] for p in pts]
    heads = [x["head"] for x in aw]
    adj_spd = sum(adjusted_speed(s, h) for s,h in zip(spds, heads)) / max(1, len(spds))
    adj_split = 500.0 / max(0.01, adj_spd)  # s/500m

    DB[tid]["summary"] = {
        "duration_s": dur,
        "median_aws": median_aws,
        "pct_head": head_pos/len(aw),
        "pct_tail": tail_pos/len(aw),
        "pct_cross": cross_pos/len(aw),
        "hed_m": hed,  # unit: (m/s * s) ~= m headwind-equivalent
        "adj_avg_split_s_per_500": adj_split,
    }

    return {"ok": True, "count": len(aw)}

@app.get("/api/tracks/{tid}/series")
async def get_series(tid: str):
    if tid not in DB:
        raise HTTPException(404)
    return {"track_id": tid, "samples": DB[tid]["series"]}

@app.get("/api/tracks/{tid}/aw")
async def get_aw(tid: str):
    if tid not in DB or "aw" not in DB[tid]:
        raise HTTPException(404)
    return {"track_id": tid, "aws": DB[tid]["aw"]}

@app.get("/api/tracks/{tid}/summary")
async def get_summary(tid: str):
    if tid not in DB or "summary" not in DB[tid]:
        raise HTTPException(404)
    return DB[tid]["summary"]
