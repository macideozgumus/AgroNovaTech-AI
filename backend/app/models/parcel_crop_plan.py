from __future__ import annotations

from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ParcelCropPlan(Base):
    __tablename__ = "parcel_crop_plan"
    __table_args__ = (UniqueConstraint("parcel_id", "season", name="uq_parcel_crop_plan_parcel_season"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    parcel_id: Mapped[str] = mapped_column(ForeignKey("parcel.id"), nullable=False, index=True)
    season: Mapped[str] = mapped_column(String(64), nullable=False)
    crop_id: Mapped[str] = mapped_column(ForeignKey("crop_catalog.id"), nullable=False)
    sowing_date: Mapped[Optional[object]] = mapped_column(Date, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    parcel = relationship("Parcel", back_populates="crop_plans")
