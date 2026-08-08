"""Add a per-user content hash so repeated CSV imports stay idempotent.

Revision ID: 0003_add_dataset_content_hash
Revises: 0002_add_user_finance_schema
Create Date: 2026-08-08
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0003_add_dataset_content_hash"
down_revision: str | None = "0002_add_user_finance_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "transaction_datasets",
        sa.Column("content_hash", sa.String(length=64), nullable=True),
    )
    # Datasets imported before this revision have no stored upload fingerprint;
    # seed a unique placeholder so the constraint can be enforced immediately.
    op.execute(
        "UPDATE transaction_datasets "
        "SET content_hash = md5(id::text) "
        "WHERE content_hash IS NULL"
    )
    op.alter_column("transaction_datasets", "content_hash", nullable=False)
    op.create_unique_constraint(
        "uq_transaction_datasets_user_content",
        "transaction_datasets",
        ["user_id", "content_hash"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_transaction_datasets_user_content",
        "transaction_datasets",
        type_="unique",
    )
    op.drop_column("transaction_datasets", "content_hash")
