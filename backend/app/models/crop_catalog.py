from __future__ import annotations

from typing import Optional

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CropCatalog(Base):
    __tablename__ = "crop_catalog"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    crop_name: Mapped[str] = mapped_column(String(128), nullable=False)
    group_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
