# XBoat Apparent Wind Analyzer

Implementation for the XBoat Full-Stack Engineer take-home: load GPS data, fetch ambient wind (Open-Meteo), compute apparent wind per point, visualize it, and summarize impact.

This repo provides **clear setup instructions** and a simple local/Docker run path to meet the deliverable, with notes that map to the evaluation criteria (Correctness, Product Thinking, Creativity & Design, Quality).

---

## Contents

- [Architecture](#architecture)
- [Repo Structure](#repo-structure)
- [Prerequisites](#prerequisites)
- [Quickstart — Local](#quickstart--local)
- [Quickstart — Docker](#quickstart--docker)
- [Configuration](#configuration)
- [API (default contract)](#api-default-contract)
- [How It Works (apparent wind math)](#how-it-works-apparent-wind-math)
- [Testing & Linting](#testing--linting)
- [Troubleshooting](#troubleshooting)
- [Evaluation Mapping](#evaluation-mapping)
- [License](#license)

---

## Architecture

```
frontend (React/TS)  →  backend (FastAPI)
           ↑                 ↓
      charts & UI     parse GPS, call Open-Meteo,
                      compute apparent wind, return JSON
```

Data flow:
1) Upload GPX/TCX (or JSON of points).
2) Backend aligns GPS timestamps to ambient wind from Open-Meteo.
3) Apparent wind calculated per point.
4) Frontend renders charts + a brief analysis panel.

---

## Repo Structure

```
backend/        FastAPI service (API, parsing, compute)
frontend/       React + TypeScript app (charts, views)
infra/          (optional) deploy configs/IaC
.env.example    Example configuration
docker-compose.yml
```

> This matches the current repo layout. If you add or rename folders, update this section accordingly.

---

## Prerequisites

- Python 3.11+
- Node 20+ and npm (or pnpm)
- (Optional) Docker 24+

---

## Quickstart — Local

Open **two terminals** (one for backend, one for frontend).

### 1) Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
# Optional: copy env if the backend reads its own .env
# cp ../.env.example .env

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- Health check: http://localhost:8000/health

### 2) Frontend

```bash
cd frontend
npm i
# If using Vite, set API base URL the app will call:
# echo 'VITE_API_BASE_URL="http://localhost:8000"' > .env
npm run dev
```

- Visit the dev URL shown in your terminal (Vite is typically http://localhost:5173).

---

## Quickstart — Docker

```bash
# from repo root
cp .env.example .env   # adjust values as needed
docker compose up --build
```

- Backend: http://localhost:8000
- Frontend: http://localhost:5173 (unless overridden in compose/env)

---

## Configuration

Copy `.env.example` → `.env` at the repo root (and also create per-app `.env` files if your services read them from their own working directory).

Common variables (adjust to your code):

```
# Backend
API_PORT=8000
OPEN_METEO_TIMEOUT_SECONDS=12

# Frontend (Vite)
VITE_API_BASE_URL=http://localhost:8000
```

**Open-Meteo** is keyless; still document timeouts and any rate-limit handling you implement.

---

## API (default contract)

> If your endpoint names differ, update here and in the frontend.

- `GET /health` → `{"status":"ok"}`
- `POST /compute` (multipart form file upload)
  - Body: `file=@run.gpx` (also supports `.tcx`)
  - Response (example shape):

```json
{
  "points": [
    {
      "t": "2025-09-07T12:00:00Z",
      "lat": 42.36,
      "lon": -71.06,
      "speed_ms": 5.4,
      "ambient_speed_ms": 3.8,
      "ambient_dir_deg": 270,
      "apparent_speed_ms": 8.9,
      "apparent_dir_deg": 290
    }
  ],
  "summary": {
    "count": 1234,
    "apparent_speed_ms_mean": 7.2,
    "head_cross_tail_split": {"head": 0.41, "cross": 0.37, "tail": 0.22}
  }
}
```

**Curl examples**

```bash
# Health
curl http://localhost:8000/health

# Compute on a sample file (replace with your path)
curl -F "file=@scripts/sample_data/short.gpx" http://localhost:8000/compute | jq .
```

---

## How It Works (apparent wind math)

- Compute **object ground-speed** and **heading** from consecutive GPS fixes.
- Convert **ambient wind** (speed + meteorological direction) to a vector in a standard math frame (0° = +x, counter-clockwise positive), taking care to map from “blowing from” to the correct vector sign.
- Convert **object velocity** (speed + heading) to a vector in the same frame.
- **Apparent wind** vector = **ambient** − **object_velocity**.
- Report **magnitude** (speed) and **relative bearing** (e.g., vs. boat heading for head/cross/tail classification).

Include unit tests for simple cases:
- Headwind: 10 mph ambient from 0° vs. 10 mph forward → 20 mph apparent.
- Tailwind: 10 with 10 same direction → 0 mph apparent (idealized).
- Crosswind: orthogonal vectors → Pythagorean magnitude.

---

## Testing & Linting

```bash
# Backend
cd backend
pytest -q
ruff check . && ruff format .

# Frontend
cd ../frontend
npm run test --if-present
npm run lint && npm run format
```

> Add a couple of backend unit tests for: GPS parsing edge-cases, Open-Meteo client (stubbed), and vector math (head/tail/cross). Frontend tests can focus on data transforms and component rendering.

---

## Troubleshooting

- **Frontend can’t reach backend**  
  Ensure `VITE_API_BASE_URL` (or your equivalent) points to the running backend (e.g., `http://localhost:8000`).

- **CORS errors**  
  Enable CORS in FastAPI for `http://localhost:5173` (or your dev origin).

- **No data appears**  
  Confirm the upload actually posts and your backend logs a `/compute` hit; try the curl command with a known-good GPX.

- **Repo hygiene**  
  Avoid committing virtualenvs (`.venv/`) or `node_modules/`. Use a `.gitignore` entry for each.

---

## Evaluation Mapping

- **Correctness** — Apparent wind formula documented and tested; timestamps aligned; careful direction conventions.
- **Product Thinking** — Clear upload flow, obvious defaults, concise summary panel (head/cross/tail proportions, segment highlights).
- **Creativity & Design** — Readable charts and tooltips; responsive layout; sensible legends.
- **Quality** — Typed models (Pydantic/TS), linting/formatting, basic tests, and optional Docker/CI.

---

## License

MIT (or your preferred OSS license)
