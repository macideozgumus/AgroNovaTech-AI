"""init core tables for village/parcel/cropplan/decision

Revision ID: 20260224_0001
Revises:
Create Date: 2026-02-24
"""

from alembic import op
import sqlalchemy as sa


revision = "20260224_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "village",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("center_lat", sa.Float(), nullable=True),
        sa.Column("center_lng", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
    )

    op.create_table(
        "crop_catalog",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("crop_name", sa.String(length=128), nullable=False),
        sa.Column("group_name", sa.String(length=128), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )

    op.create_table(
        "parcel",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("village_id", sa.String(length=64), sa.ForeignKey("village.id"), nullable=False),
        sa.Column("name", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="UNKNOWN"),
        sa.Column("geometry_json", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
    )
    op.create_index("ix_parcel_village_id", "parcel", ["village_id"])

    op.create_table(
        "parcel_adjacency",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("village_id", sa.String(length=64), sa.ForeignKey("village.id"), nullable=False),
        sa.Column("parcel_id", sa.String(length=64), sa.ForeignKey("parcel.id"), nullable=False),
        sa.Column("neighbor_parcel_id", sa.String(length=64), sa.ForeignKey("parcel.id"), nullable=False),
        sa.Column("weight", sa.Float(), nullable=True),
    )
    op.create_index("ix_parcel_adjacency_village_id", "parcel_adjacency", ["village_id"])
    op.create_index("ix_parcel_adjacency_parcel_id", "parcel_adjacency", ["parcel_id"])
    op.create_index("ix_parcel_adjacency_neighbor_parcel_id", "parcel_adjacency", ["neighbor_parcel_id"])

    op.create_table(
        "parcel_crop_plan",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("parcel_id", sa.String(length=64), sa.ForeignKey("parcel.id"), nullable=False),
        sa.Column("season", sa.String(length=64), nullable=False),
        sa.Column("crop_id", sa.String(length=64), sa.ForeignKey("crop_catalog.id"), nullable=False),
        sa.Column("sowing_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.UniqueConstraint("parcel_id", "season", name="uq_parcel_crop_plan_parcel_season"),
    )
    op.create_index("ix_parcel_crop_plan_parcel_id", "parcel_crop_plan", ["parcel_id"])

    op.create_table(
        "decision_result",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("village_id", sa.String(length=64), sa.ForeignKey("village.id"), nullable=False),
        sa.Column("parcel_id", sa.String(length=64), sa.ForeignKey("parcel.id"), nullable=True),
        sa.Column("season", sa.String(length=64), nullable=False),
        sa.Column("risk_score", sa.Integer(), nullable=False),
        sa.Column("risk_level", sa.String(length=16), nullable=False),
        sa.Column("reasons_json", sa.JSON(), nullable=False),
        sa.Column("recommendations_json", sa.JSON(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("model_version", sa.String(length=64), nullable=False),
        sa.Column("decision_run_id", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
    )
    op.create_index("ix_decision_result_village_id", "decision_result", ["village_id"])
    op.create_index("ix_decision_result_parcel_id", "decision_result", ["parcel_id"])
    op.create_index("ix_decision_result_season", "decision_result", ["season"])
    op.create_index("ix_decision_result_decision_run_id", "decision_result", ["decision_run_id"])


def downgrade() -> None:
    op.drop_index("ix_decision_result_decision_run_id", table_name="decision_result")
    op.drop_index("ix_decision_result_season", table_name="decision_result")
    op.drop_index("ix_decision_result_parcel_id", table_name="decision_result")
    op.drop_index("ix_decision_result_village_id", table_name="decision_result")
    op.drop_table("decision_result")

    op.drop_index("ix_parcel_crop_plan_parcel_id", table_name="parcel_crop_plan")
    op.drop_table("parcel_crop_plan")

    op.drop_index("ix_parcel_adjacency_neighbor_parcel_id", table_name="parcel_adjacency")
    op.drop_index("ix_parcel_adjacency_parcel_id", table_name="parcel_adjacency")
    op.drop_index("ix_parcel_adjacency_village_id", table_name="parcel_adjacency")
    op.drop_table("parcel_adjacency")

    op.drop_index("ix_parcel_village_id", table_name="parcel")
    op.drop_table("parcel")

    op.drop_table("crop_catalog")
    op.drop_table("village")

