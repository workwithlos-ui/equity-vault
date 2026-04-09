"""
Deal Routes — 6 endpoints. The entire backend API.
"""

from datetime import datetime
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.deal import Deal, Profile, Score
from app.services.profiler import enrich_company
from app.services.scorer import score_deal
from app.services.brief_generator import generate_brief

router = APIRouter(prefix="/api/deals", tags=["deals"])


# ── Schemas ──────────────────────────────────────────────

class DealCreate(BaseModel):
    company_name: str
    website_url: str | None = None
    industry: str | None = None
    context: str | None = None


class DealDecision(BaseModel):
    decision: str  # "advance" or "pass"
    notes: str | None = None


class DealResponse(BaseModel):
    id: str
    company_name: str
    website_url: str | None
    industry: str | None
    context: str | None
    stage: str
    created_at: str
    updated_at: str
    profile: dict | None = None
    score: dict | None = None

    class Config:
        from_attributes = True


# ── Routes ───────────────────────────────────────────────

@router.post("", status_code=201)
def create_deal(payload: DealCreate, db: Session = Depends(get_db)):
    """Create a new deal target."""
    deal = Deal(
        company_name=payload.company_name,
        website_url=payload.website_url,
        industry=payload.industry,
        context=payload.context,
        stage="intake",
    )
    db.add(deal)
    db.commit()
    db.refresh(deal)
    return _serialize_deal(deal)


@router.get("")
def list_deals(db: Session = Depends(get_db)):
    """List all deals in pipeline."""
    deals = db.query(Deal).order_by(Deal.created_at.desc()).all()
    return [_serialize_deal(d) for d in deals]


@router.get("/{deal_id}")
def get_deal(deal_id: UUID, db: Session = Depends(get_db)):
    """Get full deal detail with profile and scores."""
    deal = db.query(Deal).filter(Deal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return _serialize_deal(deal)


@router.post("/{deal_id}/profile")
async def profile_deal(deal_id: UUID, db: Session = Depends(get_db)):
    """Trigger profiling — Apollo enrichment + web signals."""
    deal = db.query(Deal).filter(Deal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    # Run enrichment
    result = await enrich_company(deal.company_name, deal.website_url)

    # Upsert profile
    profile = db.query(Profile).filter(Profile.deal_id == deal.id).first()
    if not profile:
        profile = Profile(deal_id=deal.id)
        db.add(profile)

    profile.company_data = result["company_data"]
    profile.people_data = result["people_data"]
    profile.web_data = result["web_data"]
    profile.news_data = result["news_data"]
    profile.raw_sources = result["raw_sources"]
    profile.data_completeness = result["data_completeness"]

    # Update deal stage + industry from enrichment if missing
    deal.stage = "profiling"
    if not deal.industry and result["company_data"].get("industry"):
        deal.industry = result["company_data"]["industry"]

    deal.updated_at = datetime.utcnow()
    db.commit()

    return {"status": "profiled", "data_completeness": result["data_completeness"]}


@router.post("/{deal_id}/score")
async def score_and_brief(deal_id: UUID, db: Session = Depends(get_db)):
    """Score the deal + generate brief. Requires profile first."""
    deal = db.query(Deal).filter(Deal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    profile = db.query(Profile).filter(Profile.deal_id == deal.id).first()
    if not profile:
        raise HTTPException(status_code=400, detail="Deal must be profiled first")

    # Build profile dict for scoring
    profile_data = {
        "company_data": profile.company_data or {},
        "people_data": profile.people_data or [],
        "web_data": profile.web_data or {},
        "news_data": profile.news_data or [],
        "raw_sources": profile.raw_sources or [],
        "data_completeness": profile.data_completeness or 0,
    }

    # 1. Deterministic scoring
    scores = score_deal(profile_data)

    # 2. Generate brief (single LLM call)
    brief_result = await generate_brief(
        company_name=deal.company_name,
        profile=profile_data,
        scores=scores,
    )

    # 3. Upsert score record
    score_record = db.query(Score).filter(Score.deal_id == deal.id).first()
    if not score_record:
        score_record = Score(deal_id=deal.id)
        db.add(score_record)

    score_record.financial_score = scores["financial_score"]
    score_record.financial_evidence = scores["financial_evidence"]
    score_record.risk_score = scores["risk_score"]
    score_record.risk_evidence = scores["risk_evidence"]
    score_record.market_score = scores["market_score"]
    score_record.market_evidence = scores["market_evidence"]
    score_record.composite_score = scores["composite_score"]
    score_record.confidence = scores["confidence"]
    score_record.tier = scores["tier"]
    score_record.brief_md = brief_result["brief_md"]
    score_record.brief_evidence = brief_result["brief_evidence"]

    deal.stage = "scored"
    deal.updated_at = datetime.utcnow()
    db.commit()

    return {
        "status": "scored",
        "composite": scores["composite_score"],
        "tier": scores["tier"],
        "confidence": scores["confidence"],
    }


@router.post("/{deal_id}/decide")
def decide_deal(deal_id: UUID, payload: DealDecision, db: Session = Depends(get_db)):
    """Operator makes advance/pass decision."""
    deal = db.query(Deal).filter(Deal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    score_record = db.query(Score).filter(Score.deal_id == deal.id).first()
    if not score_record:
        raise HTTPException(status_code=400, detail="Deal must be scored first")

    if payload.decision not in ("advance", "pass"):
        raise HTTPException(status_code=400, detail="Decision must be 'advance' or 'pass'")

    score_record.operator_decision = payload.decision
    score_record.operator_notes = payload.notes
    score_record.decision_at = datetime.utcnow()

    deal.stage = "advanced" if payload.decision == "advance" else "passed"
    deal.updated_at = datetime.utcnow()
    db.commit()

    return {
        "status": deal.stage,
        "decision": payload.decision,
        "decided_at": score_record.decision_at.isoformat(),
    }


# ── Helpers ──────────────────────────────────────────────

def _serialize_deal(deal: Deal) -> dict:
    result = {
        "id": str(deal.id),
        "company_name": deal.company_name,
        "website_url": deal.website_url,
        "industry": deal.industry,
        "context": deal.context,
        "stage": deal.stage,
        "created_at": deal.created_at.isoformat() if deal.created_at else None,
        "updated_at": deal.updated_at.isoformat() if deal.updated_at else None,
    }

    if deal.profile:
        result["profile"] = {
            "company_data": deal.profile.company_data,
            "people_data": deal.profile.people_data,
            "web_data": deal.profile.web_data,
            "data_completeness": deal.profile.data_completeness,
            "raw_sources": deal.profile.raw_sources,
        }

    if deal.score:
        result["score"] = {
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

    return result
