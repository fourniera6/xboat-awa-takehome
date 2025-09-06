# xboat-awa-takehome

A minimal FastAPI + React scaffold to parse GPX/TCX/FIT, fetch ambient wind from Open‑Meteo, compute apparent wind (AWS/AWA + head/cross), and visualize results. Includes system light/dark with override.

## Quickstart

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd ../frontend
npm install
npm run dev  # http://localhost:5173 (set VITE_API_URL if needed)
```

## Default sample files
Place your baseline files here (optional):

```
backend/sample_data/activity_20298293877.gpx
backend/sample_data/activity_20298293877.tcx
backend/sample_data/Swing_row.fit
```

## API (brief)
- `POST /api/upload` (multipart file -> `track_id`)
- `POST /api/tracks/{track_id}/process` (fetch wind + compute AW)
- `GET /api/tracks/{track_id}/series` (gps series)
- `GET /api/tracks/{track_id}/aw` (apparent wind series)
- `GET /api/tracks/{track_id}/summary` (metrics)

## Notes
- Ambient wind is hourly (10 m). We time-interpolate to each sample.
- Apparent wind math follows vector subtraction: **A = W - V** with meteorological “from” directions.
- The UI shows a timeseries, AWA polar rose, and a Wind Triangle; theme honors system preference with an override.
