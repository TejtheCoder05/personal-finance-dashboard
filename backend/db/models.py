from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PostgreSQLUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.database import Base


class User(Base):
    """Persistent account identity prepared for the authentication phase."""

    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("email", name="uq_users_email"),
        Index("ix_users_email", "email"),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    datasets: Mapped[list["TransactionDataset"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    savings_goals: Mapped[list["SavingsGoal"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class TransactionDataset(Base):
    """One completed, processed CSV import owned by a user."""

    __tablename__ = "transaction_datasets"
    __table_args__ = (
        UniqueConstraint("id", "user_id", name="uq_transaction_datasets_id_user"),
        Index("ix_transaction_datasets_user_created", "user_id", "created_at"),
        Index(
            "uq_transaction_datasets_active_user",
            "user_id",
            unique=True,
            postgresql_where=text("is_active"),
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    user_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    transaction_count: Mapped[int] = mapped_column(Integer, nullable=False)
    column_mapping: Mapped[dict] = mapped_column(JSONB, nullable=False)
    amount_sign: Mapped[str] = mapped_column(String(32), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    user: Mapped[User] = relationship(back_populates="datasets")
    transactions: Mapped[list["FinanceTransaction"]] = relationship(
        back_populates="dataset",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class FinanceTransaction(Base):
    """Normalized ML-enriched transaction from a persistent user import."""

    __tablename__ = "finance_transactions"
    __table_args__ = (
        ForeignKeyConstraint(
            ["dataset_id", "user_id"],
            ["transaction_datasets.id", "transaction_datasets.user_id"],
            name="fk_finance_transactions_dataset_owner",
            ondelete="CASCADE",
        ),
        Index("ix_finance_transactions_user_id", "user_id"),
        Index("ix_finance_transactions_dataset_date", "dataset_id", "date"),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    user_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    dataset_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), nullable=False
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    description_raw: Mapped[str] = mapped_column(Text, nullable=False)
    description_clean: Mapped[str] = mapped_column(Text, nullable=False)
    merchant: Mapped[str] = mapped_column(String(255), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    category_confidence: Mapped[Decimal] = mapped_column(Numeric(6, 5), nullable=False)
    is_anomaly_candidate: Mapped[bool] = mapped_column(Boolean, nullable=False)
    is_anomaly: Mapped[bool] = mapped_column(Boolean, nullable=False)
    anomaly_score: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    anomaly_reason: Mapped[str | None] = mapped_column(Text)
    merchant_median_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    merchant_amount_ratio: Mapped[Decimal | None] = mapped_column(Numeric(10, 4))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    dataset: Mapped[TransactionDataset] = relationship(back_populates="transactions")


class SavingsGoal(Base):
    """Persistent savings target owned by one authenticated user."""

    __tablename__ = "savings_goals"
    __table_args__ = (Index("ix_savings_goals_user_created", "user_id", "created_at"),)

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    user_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    target_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    current_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    target_date: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    user: Mapped[User] = relationship(back_populates="savings_goals")
