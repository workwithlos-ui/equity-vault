"""
Batch intake — paste a list of companies, process them all.
Also handles: notes, outreach, watch list, comparison, settings.
"""

from datetime import datetime, timedelta
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.deal import Deal, Profile, Score
from app.models.activity import Activity, DealNote, WatchItem, ScoringConfig
from app.services.profiler import enrich_company
from app.services.scorer import score_deal
from app.services.brief_generator import generate_brief
from app.services.outreach import generate_outreach_brief
from app.services.analytics import log_activity

router = APIRouter(prefix="/api", tags=["batch"])


# ── Batch Intake ─────────────────────────────────────────

class BatchTarget(BaseModel):
    company_name: str
    website_url: str | None = None
    industry: str | None = None
    context: str | None = None


class BatchRequest(BaseModel):
    targets: list[BatchTarget]


@router.post("/batch/intake")
async def batch_intake(payload: BatchRequest, db: Session = Depends(get_db)):
    """
    Accept multiple targets at once. Creates deals, profiles, and scores them all.
    Returns summary of results.
    """
    results = []

    for target in payload.targets:
        try:
            # 1. Create deal
            deal = Deal(
                company_name=target.company_name,
                website_url=target.website_url,
                industry=target.industry,
                context=target.context,
                stage="intake",
            )
            db.add(deal)
            db.commit()
            db.refresh(deal)

            log_activity(db, deal.id, "batch_imported", f"Batch import: {target.company_name}")

            # 2. Profile
            enrichment = await enrich_company(target.company_name, target.website_url)

            profile = Profile(
                deal_id=deal.id,
                company_data=enrichment["company_data"],
                people_data=enrichment["people_data"],
                web_data=enrichment["web_data"],
                news_data=enrichment["news_data"],
                raw_sources=enrichment["raw_sources"],
                data_completeness=enrichment["data_completeness"],
            )
            db.add(profile)

            if not deal.industry and enrichment["company_data"].get("industry"):
                deal.industry = enrichment["company_data"]["industry"]

            deal.stage = "profiling"
            db.commit()

            log_activity(db, deal.id, "profiled", f"Enriched via Apollo. Completeness: {enrichment['data_completeness']}%")

            # 3. Score
            profile_data = {
                "company_data": enrichment["company_data"],
                "people_data": enrichment["people_data"],
                "web_data": enrichment["web_data"],
                "news_data": enrichment["news_data"],
                "raw_sources": enrichment["raw_sources"],
                "data_completeness": enrichment["data_completeness"],
            }

            scores = score_deal(profile_data)

            # 4. Generate brief
            brief_result = await generate_brief(
                company_name=target.company_name,
                profile=profile_data,
                scores=scores,
            )

            score_record = Score(
                deal_id=deal.id,
                financial_score=scores["financial_score"],
                financial_evidence=scores["financial_evidence"],
                risk_score=scores["risk_score"],
                risk_evidence=scores["risk_evidence"],
                market_score=scores["market_score"],
                market_evidence=scores["market_evidence"],
                composite_score=scores["composite_score"],
                confidence=scores["confidence"],
                tier=scores["tier"],
                brief_md=brief_result["brief_md"],
                brief_evidence=brief_result["brief_evidence"],
            )
            db.add(score_record)
            deal.stage = "scored"
            deal.updated_at = datetime.utcnow()
            db.commit()

            log_activity(
                db, deal.id, "scored",
                f"Scored {scores['composite_score']}/100 ({scores['tier'].upper()}). Confidence: {scores['confidence']}.",
            )

            results.append({
                "company": target.company_name,
                "deal_id": str(deal.id),
                "status": "scored",
                "composite": scores["composite_score"],
                "tier": scores["tier"],
            })

        except Exception as e:
            results.append({
                "company": target.company_name,
                "status": "failed",
                "error": str(e),
            })

    succeeded = len([r for r in results if r["status"] == "scored"])
    failed = len([r for r in results if r["status"] == "failed"])

    return {
        "total": len(payload.targets),
        "succeeded": succeeded,
        "failed": failed,
        "results": results,
    }


# ── Deal Notes ───────────────────────────────────────────

class NoteCreate(BaseModel):
    content: str
    note_type: str = "general"  # general, risk_flag, action_item, insight
    author: str = "King"


@router.post("/deals/{deal_id}/notes")
def add_note(deal_id: UUID, payload: NoteCreate, db: Session = Depends(get_db)):
    """Add a note to a deal."""
    note = DealNote(
        deal_id=deal_id,
        content=payload.content,
        note_type=payload.note_type,
        author=payload.author,
    )
    db.add(note)
    db.commit()
    log_activity(db, deal_id, "note_added", f"{payload.author}: {payload.content[:100]}")
    return {"status": "added", "id": str(note.id)}


@router.get("/deals/{deal_id}/notes")
def get_notes(deal_id: UUID, db: Session = Depends(get_db)):
    """Get all notes for a deal."""
    notes = (
        db.query(DealNote)
        .filter(DealNote.deal_id == deal_id)
        .order_by(DealNote.created_at.desc())
        .all()
    )
    return [
        {
            "id": str(n.id),
            "content": n.content,
            "note_type": n.note_type,
            "author": n.author,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in notes
    ]


# ── Outreach Generation ──────────────────────────────────

@router.post("/deals/{deal_id}/outreach")
async def generate_outreach(deal_id: UUID, db: Session = Depends(get_db)):
    """Generate outreach materials for an advanced deal."""
    deal = db.query(Deal).filter(Deal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    profile = deal.profile
    score = deal.score
    if not profile or not score:
        raise HTTPException(status_code=400, detail="Deal must be profiled and scored first")

    result = await generate_outreach_brief(
        company_name=deal.company_name,
        profile={
            "company_data": profile.company_data or {},
            "people_data": profile.people_data or [],
        },
        scores={
            "composite_score": score.composite_score,
            "tier": score.tier,
            "confidence": score.confidence,
        },
        brief_md=score.brief_md or "",
    )

    log_activity(db, deal.id, "outreach_generated", f"Outreach brief generated for {deal.company_name}")

    return result


# ── Watch List ───────────────────────────────────────────

class WatchRequest(BaseModel):
    reason: str
    reeval_days: int = 30


@router.post("/deals/{deal_id}/watch")
def add_to_watch(deal_id: UUID, payload: WatchRequest, db: Session = Depends(get_db)):
    """Add a deal to the watch list with re-evaluation schedule."""
    deal = db.query(Deal).filter(Deal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    # Upsert watch item
    watch = db.query(WatchItem).filter(WatchItem.deal_id == deal_id).first()
    if not watch:
        watch = WatchItem(deal_id=deal_id)
        db.add(watch)

    watch.reason = payload.reason
    watch.reeval_interval_days = str(payload.reeval_days)
    watch.next_reeval_at = datetime.utcnow() + timedelta(days=payload.reeval_days)

    deal.stage = "watching"
    deal.updated_at = datetime.utcnow()
    db.commit()

    if deal.score:
        deal.score.operator_decision = "watch"
        deal.score.operator_notes = payload.reason
        deal.score.decision_at = datetime.utcnow()
        db.commit()

    log_activity(db, deal.id, "decision_watch", f"Added to watch list: {payload.reason}. Re-eval in {payload.reeval_days} days.")

    return {"status": "watching", "next_reeval": watch.next_reeval_at.isoformat()}


@router.get("/watch")
def get_watch_list(db: Session = Depends(get_db)):
    """Get all watched deals with re-evaluation status."""
    items = db.query(WatchItem).all()
    results = []
    for w in items:
        deal = db.query(Deal).filter(Deal.id == w.deal_id).first()
        results.append({
            "deal_id": str(w.deal_id),
            "company_name": deal.company_name if deal else "Unknown",
            "reason": w.reason,
            "reeval_interval_days": w.reeval_interval_days,
            "next_reeval_at": w.next_reeval_at.isoformat() if w.next_reeval_at else None,
            "overdue": w.next_reeval_at < datetime.utcnow() if w.next_reeval_at else False,
        })
    return results


# ── Deal Comparison ──────────────────────────────────────

class CompareRequest(BaseModel):
    deal_ids: list[str]


@router.post("/compare")
def compare_deals(payload: CompareRequest, db: Session = Depends(get_db)):
    """Compare multiple deals side by side."""
    deals = []
    for did in payload.deal_ids[:5]:  # max 5
        deal = db.query(Deal).filter(Deal.id == did).first()
        if deal and deal.score:
            deals.append({
                "id": str(deal.id),
                "company_name": deal.company_name,
                "industry": deal.industry,
                "stage": deal.stage,
                "composite_score": deal.score.composite_score,
                "financial_score": deal.score.financial_score,
                "market_score": deal.score.market_score,
                "risk_score": deal.score.risk_score,
                "tier": deal.score.tier,
                "confidence": deal.score.confidence,
                "employee_count": (deal.profile.company_data or {}).get("employee_count") if deal.profile else None,
                "revenue": (deal.profile.company_data or {}).get("estimated_revenue") if deal.profile else None,
                "decision": deal.score.operator_decision,
            })
    return {"deals": deals, "count": len(deals)}


# ── Scoring Config ───────────────────────────────────────

class ConfigUpdate(BaseModel):
    financial_weight: float = 0.40
    market_weight: float = 0.35
    risk_weight: float = 0.25
    hot_threshold: int = 75
    warm_threshold: int = 55
    cool_threshold: int = 35


@router.get("/settings/scoring")
def get_scoring_config(db: Session = Depends(get_db)):
    """Get current scoring configuration."""
    config = db.query(ScoringConfig).filter(ScoringConfig.config_name == "default").first()
    if not config:
        return {
            "financial_weight": 0.40, "market_weight": 0.35, "risk_weight": 0.25,
            "hot_threshold": 75, "warm_threshold": 55, "cool_threshold": 35,
        }
    return {
        "financial_weight": float(config.financial_weight),
        "market_weight": float(config.market_weight),
        "risk_weight": float(config.risk_weight),
        "hot_threshold": int(config.hot_threshold),
        "warm_threshold": int(config.warm_threshold),
        "cool_threshold": int(config.cool_threshold),
    }


@router.put("/settings/scoring")
def update_scoring_config(payload: ConfigUpdate, db: Session = Depends(get_db)):
    """Update scoring weights and thresholds."""
    # Validate weights sum to ~1.0
    total = payload.financial_weight + payload.market_weight + payload.risk_weight
    if abs(total - 1.0) > 0.01:
        raise HTTPException(status_code=400, detail=f"Weights must sum to 1.0 (got {total})")

    config = db.query(ScoringConfig).filter(ScoringConfig.config_name == "default").first()
    if not config:
        config = ScoringConfig(config_name="default")
        db.add(config)

    config.financial_weight = str(payload.financial_weight)
    config.market_weight = str(payload.market_weight)
    config.risk_weight = str(payload.risk_weight)
    config.hot_threshold = str(payload.hot_threshold)
    config.warm_threshold = str(payload.warm_threshold)
    config.cool_threshold = str(payload.cool_threshold)
    config.updated_at = datetime.utcnow()
    db.commit()

    return {"status": "updated"}
