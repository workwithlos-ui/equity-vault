"""
Activity log + deal notes — every action recorded, every note timestamped.
This IS the audit trail.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Activity(Base):
    __tablename__ = "activities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deal_id = Column(UUID(as_uuid=True), ForeignKey("deals.id"), nullable=False, index=True)
    action_type = Column(String(50), nullable=False)
    # types: created, profiled, scored, decision_advance, decision_pass,
    #        decision_watch, note_added, outreach_generated, rescored,
    #        batch_imported, exported, comparison_created
    actor = Column(String(100), default="system")  # "system" or operator name
    summary = Column(Text)  # human-readable summary
    metadata = Column(JSON, default=dict)  # action-specific data
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class DealNote(Base):
    __tablename__ = "deal_notes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deal_id = Column(UUID(as_uuid=True), ForeignKey("deals.id"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    author = Column(String(100), default="King")
    note_type = Column(String(50), default="general")  # general, risk_flag, action_item, insight
    created_at = Column(DateTime, default=datetime.utcnow)


class WatchItem(Base):
    __tablename__ = "watch_list"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deal_id = Column(UUID(as_uuid=True), ForeignKey("deals.id"), nullable=False, unique=True)
    reason = Column(Text)  # why watching
    reeval_interval_days = Column(String(10), default="30")  # how often to re-check
    last_reeval_at = Column(DateTime)
    next_reeval_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)


class ScoringConfig(Base):
    __tablename__ = "scoring_config"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    config_name = Column(String(100), default="default", unique=True)
    financial_weight = Column(String(10), default="0.40")
    market_weight = Column(String(10), default="0.35")
    risk_weight = Column(String(10), default="0.25")
    hot_threshold = Column(String(10), default="75")
    warm_threshold = Column(String(10), default="55")
    cool_threshold = Column(String(10), default="35")
    custom_signals = Column(JSON, default=dict)  # additional scoring signals
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
