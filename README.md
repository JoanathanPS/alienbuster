<div align="center">

<img src="./alienbuster-header.png" alt="AlienBuster - AI-Powered Early Warning System for Invasive Species" width="100%" />

# 🛰️ AlienBuster

### AI-Powered Early Warning System & Nature-Forward Operations Console for Invasive Species Detection

[![GitHub Repository](https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github)](https://github.com/JoanathanPS/alienbuster)
[![Canva Presentation](https://img.shields.io/badge/Canva-Slide_Deck-00C4CC?style=for-the-badge&logo=canva&logoColor=white)](https://canva.link/0pmea91ua4h69jf)
[![Live Demo](https://img.shields.io/badge/Live-Demo-22c55e?style=for-the-badge&logo=vercel&logoColor=white)](https://alienbuster.joanathan.in)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

<br />

**Crowdsourced ground truth + remote sensing $\rightarrow$ decision-ready incidents.**  
*Detect ecological bio-threats 6–12 months earlier than traditional surveys.*

---

</div>

## 📌 Project Links & Resources

- 🎨 **Canva Presentation / Pitch Deck:** [canva.link/0pmea91ua4h69jf](https://canva.link/0pmea91ua4h69jf)
- 💻 **GitHub Repository:** [github.com/JoanathanPS/alienbuster](https://github.com/JoanathanPS/alienbuster)
- 🌐 **Live Web Application:** [alienbuster.joanathan.in](https://alienbuster.joanathan.in)

---

## 🌿 About AlienBuster

**AlienBuster** is an eco-defense intelligence platform and nature-forward operations console designed to protect fragile biodiversity and native ecosystems. By fusing BioCLIP machine learning vision, satellite remote sensing change detection, and clustered crowdsourced field observations, AlienBuster turns raw ecological data into clear, explainable, and actionable threat incidents.

### Key Capabilities

- **🛰️ Early Warning Signals:** Spot invasive species clusters 6–12 months prior to conventional surveys.
- **🔍 Multi-Modal Bio-Intelligence:** AI species identification powered by BioCLIP integrated with satellite telemetry.
- **🗺️ Geospatial Threat Mapping:** Interactive heatmaps, marker clustering, and geographic incident tracking with Leaflet.
- **⚡ Calm Signals, Rapid Response:** Triage priority levels, review crowdsourced sightings, and dispatch field response teams.

<p align="center">
  <img src="https://github.com/user-attachments/assets/f9a20b82-a62d-423b-8c4b-58cb399d771b" alt="AlienBuster Operations Console UI" width="600" />
</p>

---

## 🛠️ Tech Stack & Architecture

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, Radix UI / shadcn, Leaflet, Framer Motion
- **Backend:** Python, FastAPI, Uvicorn, Pydantic, Pillow
- **Data & Storage:** Supabase (PostgreSQL with RLS) with SQLite local fallback
- **Ecosystem & ML:** BioCLIP image models, Earth Engine remote sensing integration

---

## 🚀 Development & Deployment

The project contains two pieces:

1. **Frontend:** Located under `src/` and built with Vite/React. Run with `npm run dev`.
2. **Backend:** Python/FastAPI service in `backend/`; run with Uvicorn.

The backend defaults to **SQLite** (local file) but connects to Supabase when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured.

### Environment Variables

Add the variables shown in `.env.example` to `.env` and/or `.env.local`. The public keys (URL, publishable key) are safe to commit; the service role key must remain secret.

### Running Locally

```bash
# 1. Install dependencies
cd backend && pip install -r requirements.txt && cd ..
npm install

# 2. Start services (Option A: Combined launcher on Windows)
run_app.bat

# Option B: Start backend and frontend separately
python -m uvicorn backend.main:app --reload --port 8000
npm run dev
```

### Docker (Backend)

A `Dockerfile` is included for containerized deployment:

```bash
docker build -t alienbuster-backend .
docker run -e SUPABASE_URL=... -e SUPABASE_SERVICE_ROLE_KEY=... -e EARTH_ENGINE_PROJECT=... -p 8000:8000 alienbuster-backend
```

### Deployment

- **Frontend:** Deployable to Vercel, Netlify, or any static/SPA hosting provider. Set `VITE_` variables in the dashboard.
- **Backend:** Deployable to any Python cloud container host (Fly.io, Railway, AWS ECS, Heroku). Supply Supabase credentials securely.
- **Database:** Run the SQL migrations (`supabase/migrations/`) on your Supabase Postgres database.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
