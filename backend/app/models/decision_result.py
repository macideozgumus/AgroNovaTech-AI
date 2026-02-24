from __future__ import annotations

from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class DecisionResult(Base):
    __tablename__ = "decision_result"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    village_id: Mapped[str] = mapped_column(ForeignKey("village.id"), nullable=False, index=True)
    parcel_id: Mapped[Optional[str]] = mapped_column(ForeignKey("parcel.id"), nullable=True, index=True)
    season: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    risk_score: Mapped[int] = mapped_column(Integer, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(16), nullable=False)
    reasons_json: Mapped[object] = mapped_column(JSON, nullable=False)
    recommendations_json: Mapped[object] = mapped_column(JSON, nullable=False)
    confidence: Mapped[Optional[float]] = mapped_column(nullable=True)
    model_version: Mapped[str] = mapped_column(String(64), nullable=False)
    decision_run_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())

    parcel = relationship("Parcel", back_populates="decisions")
