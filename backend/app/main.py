"""
Equity Vault — Deal Intelligence API
FastAPI backend. 6 routes. Deterministic scoring. One LLM call per deal.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.database import init_db
from app.routers.deals import router as deals_router
from app.routers.analytics import router as analytics_router
from app.routers.batch import router as batch_router

settings = get_settings()

app = FastAPI(
    title="Equity Vault",
    description="Autonomous deal intelligence. Profile → Score → Brief → Decide.",
    version="2.0.0",
)

# CORS — allow Vercel frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(deals_router)
app.include_router(analytics_router)
app.include_router(batch_router)


@app.on_event("startup")
def startup():
    init_db()


@app.get("/health")
def health():
    return {"status": "operational", "product": "Equity Vault", "version": "2.0.0"}
