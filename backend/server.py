"""
Legacy entrypoint for backward compatibility with older scripts.
The primary FastAPI application is defined in `backend.main:app`.
"""
from backend.main import app

__all__ = ["app"]
