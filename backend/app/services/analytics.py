"""
Analytics Engine — pipeline metrics, score distributions, decision patterns.
Pure SQL queries, no LLM. Returns structured data for frontend charts.
"""

from sqlalchemy.orm import Session
from sqlalchemy import func, case
from app.models.deal import Deal, Score
from app.models.activity import Activity


def get_pipeline_stats(db: Session) -> dict:
    """Pipeline overview: counts by stage, tier, decision."""

    total = db.query(func.count(Deal.id)).scalar() or 0

    # Stage breakdown
    stage_counts = dict(
        db.query(Deal.stage, func.count(Deal.id))
        .group_by(Deal.stage)
        .all()
    )

    # Tier breakdown (scored deals only)
    tier_counts = dict(
        db.query(Score.tier, func.count(Score.id))
        .filter(Score.tier.isnot(None))
        .group_by(Score.tier)
        .all()
    )

    # Decision breakdown
    decision_counts = dict(
        db.query(Score.operator_decision, func.count(Score.id))
        .filter(Score.operator_decision.isnot(None))
        .group_by(Score.operator_decision)
        .all()
    )

    # Score averages
    avg_scores = db.query(
        func.avg(Score.composite_score),
        func.avg(Score.financial_score),
        func.avg(Score.market_score),
        func.avg(Score.risk_score),
    ).first()

    # Conversion rate
    advanced = decision_counts.get("advance", 0)
    passed = decision_counts.get("pass", 0)
    decided = advanced + passed
    conversion_rate = round((advanced / decided * 100), 1) if decided > 0 else 0

    # Score distribution (buckets of 10)
    score_distribution = []
    for bucket_start in range(0, 100, 10):
        bucket_end = bucket_start + 10
        count = (
            db.query(func.count(Score.id))
            .filter(Score.composite_score >= bucket_start)
            .filter(Score.composite_score < bucket_end)
            .scalar()
        ) or 0
        score_distribution.append({
            "range": f"{bucket_start}-{bucket_end - 1}",
            "count": count,
        })

    # Recent activity
    recent = (
        db.query(Activity)
        .order_by(Activity.created_at.desc())
        .limit(20)
        .all()
    )

    return {
        "total_deals": total,
        "stage_counts": stage_counts,
        "tier_counts": tier_counts,
        "decision_counts": decision_counts,
        "conversion_rate": conversion_rate,
        "avg_composite": round(avg_scores[0] or 0, 1),
        "avg_financial": round(avg_scores[1] or 0, 1),
        "avg_market": round(avg_scores[2] or 0, 1),
        "avg_risk": round(avg_scores[3] or 0, 1),
        "score_distribution": score_distribution,
        "recent_activity": [
            {
                "id": str(a.id),
                "deal_id": str(a.deal_id),
                "action_type": a.action_type,
                "actor": a.actor,
                "summary": a.summary,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in recent
        ],
    }


def get_deal_timeline(db: Session, deal_id) -> list:
    """Full activity timeline for a single deal."""
    activities = (
        db.query(Activity)
        .filter(Activity.deal_id == deal_id)
        .order_by(Activity.created_at.desc())
        .all()
    )
    return [
        {
            "id": str(a.id),
            "action_type": a.action_type,
            "actor": a.actor,
            "summary": a.summary,
            "metadata": a.extra_data,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in activities
    ]


def log_activity(
    db: Session,
    deal_id,
    action_type: str,
    summary: str,
    actor: str = "system",
    metadata: dict = None,
):
    """Log an activity event."""
    activity = Activity(
        deal_id=deal_id,
        action_type=action_type,
        actor=actor,
        summary=summary,
        extra_data=metadata or {},
    )
    db.add(activity)
    db.commit()
