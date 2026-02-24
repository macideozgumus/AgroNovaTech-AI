from __future__ import annotations

from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Parcel(Base):
    __tablename__ = "parcel"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    village_id: Mapped[str] = mapped_column(ForeignKey("village.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="UNKNOWN")
    geometry_json: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())

    village = relationship("Village", back_populates="parcels")
    crop_plans = relationship("ParcelCropPlan", back_populates="parcel")
    decisions = relationship("DecisionResult", back_populates="parcel")
