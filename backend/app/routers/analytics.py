"""
Analytics + Export + Settings routes.
"""

from uuid import UUID
from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.services.analytics import get_pipeline_stats, get_deal_timeline
from app.services.export_engine import export_pipeline_csv, export_deal_json

router = APIRouter(prefix="/api", tags=["analytics"])


@router.get("/analytics")
def pipeline_analytics(db: Session = Depends(get_db)):
    """Full pipeline analytics — stats, distributions, activity feed."""
    return get_pipeline_stats(db)


@router.get("/deals/{deal_id}/timeline")
def deal_timeline(deal_id: UUID, db: Session = Depends(get_db)):
    """Activity timeline for a specific deal."""
    return get_deal_timeline(db, deal_id)


@router.get("/export/pipeline", response_class=PlainTextResponse)
def export_pipeline(db: Session = Depends(get_db)):
    """Export full pipeline as CSV."""
    csv_str = export_pipeline_csv(db)
    return PlainTextResponse(
        content=csv_str,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=equity_vault_pipeline.csv"},
    )


@router.get("/export/deals/{deal_id}")
def export_deal(deal_id: UUID, db: Session = Depends(get_db)):
    """Export single deal as JSON snapshot."""
    return export_deal_json(db, deal_id)
