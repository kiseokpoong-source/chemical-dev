from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Float, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

DATABASE_URL = "sqlite:///./chemical_dev.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Formula(Base):
    __tablename__ = "formulas"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    category = Column(String(100))          # 세정제, 코팅제, 제거제 등
    purpose = Column(Text)                   # 개발 목적/요구사항
    ingredients = Column(JSON)               # 원료 목록 [{name, percentage, role}]
    total_weight = Column(Float, default=100.0)
    ph_target = Column(String(50))
    viscosity_target = Column(String(100))
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AIAnalysis(Base):
    __tablename__ = "ai_analyses"

    id = Column(Integer, primary_key=True, index=True)
    formula_id = Column(Integer, nullable=True)   # 연결된 처방전 ID (없을 수도 있음)
    query_type = Column(String(50))               # recommend / analyze / improve
    user_prompt = Column(Text)
    ai_provider = Column(String(50))              # openai / gemini / claude
    ai_model = Column(String(100))
    response = Column(Text)
    tokens_used = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
