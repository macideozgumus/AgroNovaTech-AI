from __future__ import annotations

from typing import Optional

from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ParcelAdjacency(Base):
    __tablename__ = "parcel_adjacency"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    village_id: Mapped[str] = mapped_column(ForeignKey("village.id"), nullable=False, index=True)
    parcel_id: Mapped[str] = mapped_column(ForeignKey("parcel.id"), nullable=False, index=True)
    neighbor_parcel_id: Mapped[str] = mapped_column(ForeignKey("parcel.id"), nullable=False, index=True)
    adjacency_type: Mapped[str] = mapped_column(String(16), nullable=False, default="INTRA_BLOCK")
    weight: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
