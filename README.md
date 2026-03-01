<img width="544" height="711" alt="image" src="https://github.com/user-attachments/assets/f9a20b82-a62d-423b-8c4b-58cb399d771b" />


## Development & Deployment

The project contains two pieces:

1. **Frontend:** located under `src/` and built with Vite/React.  Run with `npm run dev`.
2. **Backend:** Python/FastAPI service in `backend/`; run with Uvicorn.

The backend defaults to **SQLite** (local file) but will talk to Supabase if
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in the environment.

### Environment Variables

Add the variables shown in `.env.example` to `.env` and/or `.env.local`. The
public keys (URL, publishable key) are safe to commit; the service role key
must remain secret.

### Running Locally

```bash
# install deps
cd backend && pip install -r requirements.txt && cd ..
npm install

# optional: run the combined launcher script
run_app.bat  # (Windows)
# or start backend and frontend separately:
python -m uvicorn backend.main:app --reload --port 8000
npm run dev
```

### Docker (backend)

A simple `Dockerfile` is included. Build and run with:

```bash
docker build -t alienbuster-backend .
docker run -e SUPABASE_URL=... -e SUPABASE_SERVICE_ROLE_KEY=... -e EARTH_ENGINE_PROJECT=... -p 8000:8000 alienbuster-backend
```

### Deployment

- Frontend can be deployed to Vercel, Netlify, etc.  Set the `VITE_` vars in
the hosting environment.
- Backend can be deployed to any Python host (Heroku, Fly.io, AWS ECS, etc.);
  supply the Supabase credentials there and keep them secret.
- The SQL migration file (`supabase/migrations/0001_init.sql`) can be applied
  to the target Supabase project during CI or manually.

Once the environment variables are in place the app is production‑ready – the
backend will use the cloud Postgres database and the frontend will authenticate
via Supabase.
