"""Add persistent user finance schema.

Revision ID: 0002_add_user_finance_schema
Revises: 0001_create_users
Create Date: 2026-08-08
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0002_add_user_finance_schema"
down_revision: str | None = "0001_create_users"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "transaction_datasets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("transaction_count", sa.Integer(), nullable=False),
        sa.Column("column_mapping", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("amount_sign", sa.String(length=32), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id", "user_id", name="uq_transaction_datasets_id_user"),
    )
    op.create_index(
        "ix_transaction_datasets_user_created",
        "transaction_datasets",
        ["user_id", "created_at"],
    )
    op.create_index(
        "uq_transaction_datasets_active_user",
        "transaction_datasets",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("is_active"),
    )

    op.create_table(
        "finance_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("dataset_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("description_raw", sa.Text(), nullable=False),
        sa.Column("description_clean", sa.Text(), nullable=False),
        sa.Column("merchant", sa.String(length=255), nullable=False),
        sa.Column("amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("category_confidence", sa.Numeric(precision=6, scale=5), nullable=False),
        sa.Column("is_anomaly_candidate", sa.Boolean(), nullable=False),
        sa.Column("is_anomaly", sa.Boolean(), nullable=False),
        sa.Column("anomaly_score", sa.Numeric(precision=6, scale=2), nullable=False),
        sa.Column("anomaly_reason", sa.Text(), nullable=True),
        sa.Column("merchant_median_amount", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("merchant_amount_ratio", sa.Numeric(precision=10, scale=4), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["dataset_id", "user_id"],
            ["transaction_datasets.id", "transaction_datasets.user_id"],
            name="fk_finance_transactions_dataset_owner",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_finance_transactions_dataset_date",
        "finance_transactions",
        ["dataset_id", "date"],
    )
    op.create_index(
        "ix_finance_transactions_user_id",
        "finance_transactions",
        ["user_id"],
    )

    op.create_table(
        "savings_goals",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("target_amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("current_amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_savings_goals_user_created",
        "savings_goals",
        ["user_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_savings_goals_user_created", table_name="savings_goals")
    op.drop_table("savings_goals")
    op.drop_index("ix_finance_transactions_user_id", table_name="finance_transactions")
    op.drop_index("ix_finance_transactions_dataset_date", table_name="finance_transactions")
    op.drop_table("finance_transactions")
    op.drop_index("uq_transaction_datasets_active_user", table_name="transaction_datasets")
    op.drop_index("ix_transaction_datasets_user_created", table_name="transaction_datasets")
    op.drop_table("transaction_datasets")
