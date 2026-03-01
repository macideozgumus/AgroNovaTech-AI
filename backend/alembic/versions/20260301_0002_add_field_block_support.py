"""add field block support for sprint 2

Revision ID: 20260301_0002
Revises: 20260224_0001
Create Date: 2026-03-01
"""

from alembic import op
import sqlalchemy as sa


revision = "20260301_0002"
down_revision = "20260224_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "field_block",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("village_id", sa.String(length=64), sa.ForeignKey("village.id"), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("geometry_json", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
    )
    op.create_index("ix_field_block_village_id", "field_block", ["village_id"])

    op.add_column("parcel", sa.Column("field_block_id", sa.String(length=64), nullable=True))
    op.create_foreign_key("fk_parcel_field_block_id", "parcel", "field_block", ["field_block_id"], ["id"])
    op.create_index("ix_parcel_field_block_id", "parcel", ["field_block_id"])

    op.add_column(
        "parcel_adjacency",
        sa.Column("adjacency_type", sa.String(length=16), nullable=False, server_default="INTRA_BLOCK"),
    )


def downgrade() -> None:
    op.drop_column("parcel_adjacency", "adjacency_type")
    op.drop_index("ix_parcel_field_block_id", table_name="parcel")
    op.drop_constraint("fk_parcel_field_block_id", "parcel", type_="foreignkey")
    op.drop_column("parcel", "field_block_id")
    op.drop_index("ix_field_block_village_id", table_name="field_block")
    op.drop_table("field_block")
