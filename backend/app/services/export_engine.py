"""
Export Engine — generates downloadable artifacts.
CSV pipeline exports, JSON deal snapshots.
PDF generation deferred to V2 (requires wkhtmltopdf or weasyprint).
"""

import csv
import io
import json
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.deal import Deal, Score


def export_pipeline_csv(db: Session) -> str:
    """Export full pipeline as CSV string."""
    deals = db.query(Deal).order_by(Deal.created_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "Company", "Website", "Industry", "Stage",
        "Composite Score", "Financial", "Market", "Risk",
        "Tier", "Confidence", "Decision", "Decision Notes",
        "Created", "Updated",
    ])

    for d in deals:
        score = d.score
        writer.writerow([
            d.company_name,
            d.website_url or "",
            d.industry or "",
            d.stage,
            score.composite_score if score else "",
            score.financial_score if score else "",
            score.market_score if score else "",
            score.risk_score if score else "",
            score.tier if score else "",
            score.confidence if score else "",
            score.operator_decision if score else "",
            score.operator_notes if score else "",
            d.created_at.isoformat() if d.created_at else "",
            d.updated_at.isoformat() if d.updated_at else "",
        ])

    return output.getvalue()


def export_deal_json(db: Session, deal_id) -> dict:
    """Export a single deal as a complete JSON snapshot."""
    deal = db.query(Deal).filter(Deal.id == deal_id).first()
    if not deal:
        return {}

    snapshot = {
        "exported_at": datetime.utcnow().isoformat(),
        "deal": {
            "id": str(deal.id),
            "company_name": deal.company_name,
            "website_url": deal.website_url,
            "industry": deal.industry,
            "context": deal.context,
            "stage": deal.stage,
            "created_at": deal.created_at.isoformat() if deal.created_at else None,
        },
    }

    if deal.profile:
        snapshot["profile"] = {
            "company_data": deal.profile.company_data,
            "people_data": deal.profile.people_data,
            "web_data": deal.profile.web_data,
            "data_completeness": deal.profile.data_completeness,
            "raw_sources": deal.profile.raw_sources,
        }

    if deal.score:
        snapshot["scoring"] = {
            "financial_score": deal.score.financial_score,
            "financial_evidence": deal.score.financial_evidence,
            "market_score": deal.score.market_score,
            "market_evidence": deal.score.market_evidence,
            "risk_score": deal.score.risk_score,
            "risk_evidence": deal.score.risk_evidence,
            "composite_score": deal.score.composite_score,
            "confidence": deal.score.confidence,
            "tier": deal.score.tier,
            "brief_md": deal.score.brief_md,
            "operator_decision": deal.score.operator_decision,
            "operator_notes": deal.score.operator_notes,
            "decision_at": deal.score.decision_at.isoformat() if deal.score.decision_at else None,
        }

    return snapshot
