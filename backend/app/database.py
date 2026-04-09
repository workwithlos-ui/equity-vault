from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import get_settings

settings = get_settings()

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    # Import all models so Base.metadata knows about them
    from app.models.deal import Deal, Profile, Score  # noqa: F401
    from app.models.activity import Activity, DealNote, WatchItem, ScoringConfig  # noqa: F401
    Base.metadata.create_all(bind=engine)
