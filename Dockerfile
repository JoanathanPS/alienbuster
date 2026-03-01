# Simple Dockerfile for AlienBuster backend
# Builds a lightweight Python image with dependencies and source code.
# Usage:
#   docker build -t alienbuster-backend .
#   docker run -e SUPABASE_URL=... -e SUPABASE_SERVICE_ROLE_KEY=... -e EARTH_ENGINE_PROJECT=... -p 8000:8000 alienbuster-backend

FROM python:3.11-slim

# install system deps (Pillow, ffmpeg maybe not needed?)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

# working directory
WORKDIR /app

# copy requirements and install
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# copy entire repo (backend code) - frontend not needed in this container
COPY backend /app/backend

# expose port
EXPOSE 8000

# default command
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
