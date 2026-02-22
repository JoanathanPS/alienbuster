# AlienBuster Backend

FastAPI service for invasive species detection, satellite analysis, and risk fusion.

## Setup

1. **Install Python 3.9+**
2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
3. **Authenticate Earth Engine**:
   ```bash
   earthengine authenticate
   ```
   Follow the browser flow.
4. **Environment**:
   Copy `.env.example` to `.env` (or `.env.local`):
   ```bash
   cp .env.example .env
   ```
   Set `EARTH_ENGINE_PROJECT` to your GEE project ID.

## Run

```bash
# From project root
python -m uvicorn backend.main:app --reload --port 8000
```

## Endpoints

- `POST /detect`: BioCLIP image classification (returns top-5).
- `GET /satellite_change`: Sentinel-2 NDVI + Dynamic World landcover analysis.
- `POST /fuse`: Risk fusion engine (ML + Satellite + Density).
- `POST /report`: Create report, trigger analysis, store in SQLite.
- `GET /review_queue`: For expert review UI.
- `GET /outbreaks`: DBSCAN clustering results.

## Database

SQLite database is stored in `backend/data/alienbuster.db`.
Schema includes `reports`, `outbreaks`, `tasks`, `validations`.
