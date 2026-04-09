import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Deal(Base):
    __tablename__ = "deals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_name = Column(String(255), nullable=False)
    website_url = Column(String(500))
    industry = Column(String(255))
    context = Column(Text)  # operator notes — why are we looking at this
    stage = Column(String(50), default="intake")
    # stages: intake → profiling → scored → reviewed → advanced → passed
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    profile = relationship("Profile", back_populates="deal", uselist=False, cascade="all, delete-orphan")
    score = relationship("Score", back_populates="deal", uselist=False, cascade="all, delete-orphan")


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deal_id = Column(UUID(as_uuid=True), ForeignKey("deals.id"), nullable=False, unique=True)
    company_data = Column(JSON, default=dict)    # Apollo org enrichment
    people_data = Column(JSON, default=list)     # key people
    web_data = Column(JSON, default=dict)        # website signals
    news_data = Column(JSON, default=list)       # recent news/mentions
    raw_sources = Column(JSON, default=list)     # source URLs for evidence linking
    data_completeness = Column(Integer, default=0)  # 0-100 how much data we got
    created_at = Column(DateTime, default=datetime.utcnow)

    deal = relationship("Deal", back_populates="profile")


class Score(Base):
    __tablename__ = "scores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deal_id = Column(UUID(as_uuid=True), ForeignKey("deals.id"), nullable=False, unique=True)

    # dimension scores (1-100)
    financial_score = Column(Integer, default=0)
    financial_evidence = Column(JSON, default=list)
    risk_score = Column(Integer, default=0)
    risk_evidence = Column(JSON, default=list)
    market_score = Column(Integer, default=0)
    market_evidence = Column(JSON, default=list)

    # composite
    composite_score = Column(Integer, default=0)
    confidence = Column(String(20), default="low")  # high | medium | low
    tier = Column(String(20), default="cool")        # hot | warm | cool | pass

    # the deal brief
    brief_md = Column(Text, default="")
    brief_evidence = Column(JSON, default=list)

    # operator decision
    operator_decision = Column(String(20))  # advance | pass | null
    operator_notes = Column(Text)
    decision_at = Column(DateTime)

    created_at = Column(DateTime, default=datetime.utcnow)

    deal = relationship("Deal", back_populates="score")
