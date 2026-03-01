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

By default the service stores data in a local SQLite file at
`backend/data/alienbuster.db` (used during development when `SUPABASE_URL`
and `SUPABASE_SERVICE_ROLE_KEY` are **not** set).

To run against Supabase instead, set the following environment variables
before starting the server:

```bash
SUPABASE_URL="https://<your-project>.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
```

The application will automatically switch over to using the cloud Postgres
database; the schema is expected to match the frontend types (see
`supabase/migrations/0001_init.sql`).

Schema tables include `reports`, `validations`, `user_roles`, etc.
