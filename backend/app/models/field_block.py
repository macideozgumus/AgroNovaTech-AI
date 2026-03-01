from __future__ import annotations

from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class FieldBlock(Base):
    __tablename__ = "field_block"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    village_id: Mapped[str] = mapped_column(ForeignKey("village.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    geometry_json: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())

    village = relationship("Village", back_populates="field_blocks")
    parcels = relationship("Parcel", back_populates="field_block")
