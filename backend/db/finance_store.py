"""User-scoped persistence for imported transactions.

Every function here takes the authenticated ``user_id`` resolved server-side and
filters on it, so a dataset identifier alone can never reach another account's
financial data.
"""

from __future__ import annotations

import json
from decimal import Decimal
from hashlib import sha256
from uuid import UUID, uuid4

import pandas as pd
from sqlalchemy import delete, insert, select, update
from sqlalchemy.orm import Session

from backend.db.models import FinanceTransaction, TransactionDataset


# Columns rebuilt from PostgreSQL for the pandas analytics pipeline.
FRAME_COLUMNS = (
    "date",
    "description_raw",
    "description_clean",
    "merchant",
    "amount",
    "category",
    "category_confidence",
    "is_anomaly_candidate",
    "is_anomaly",
    "anomaly_score",
    "anomaly_reason",
    "merchant_median_amount",
    "merchant_amount_ratio",
)

MAX_RATIO = Decimal("999999.9999")


def dataset_fingerprint(
    content: bytes,
    column_mapping: dict[str, str],
    amount_sign: str | None,
) -> str:
    """Fingerprint an upload so re-importing the same CSV is not duplicated."""

    digest = sha256()
    digest.update(content)
    digest.update(json.dumps(column_mapping, sort_keys=True).encode("utf-8"))
    digest.update((amount_sign or "").encode("utf-8"))
    return digest.hexdigest()


def _optional_decimal(
    value: object,
    places: int,
    limit: Decimal | None = None,
) -> Decimal | None:
    if value is None or pd.isna(value):
        return None
    number = Decimal(str(round(float(value), places)))
    if limit is not None:
        number = max(min(number, limit), -limit)
    return number


def _decimal(value: object, places: int) -> Decimal:
    number = _optional_decimal(value, places)
    return Decimal("0") if number is None else number


def _text(value: object) -> str | None:
    if value is None or pd.isna(value):
        return None
    return str(value)


def _transaction_rows(
    transactions: pd.DataFrame,
    user_id: UUID,
    dataset_id: UUID,
) -> list[dict]:
    rows: list[dict] = []
    for record in transactions.to_dict("records"):
        rows.append(
            {
                "id": uuid4(),
                "user_id": user_id,
                "dataset_id": dataset_id,
                "date": pd.Timestamp(record["date"]).date(),
                "description_raw": str(record["description_raw"]),
                "description_clean": str(record["description_clean"]),
                "merchant": str(record["merchant"])[:255],
                "amount": _decimal(record["amount"], 2),
                "category": str(record.get("category", "Uncategorized"))[:100],
                "category_confidence": _decimal(
                    record.get("category_confidence", 0), 5
                ),
                "is_anomaly_candidate": bool(record.get("is_anomaly_candidate", False)),
                "is_anomaly": bool(record.get("is_anomaly", False)),
                "anomaly_score": _decimal(record.get("anomaly_score", 0), 2),
                "anomaly_reason": _text(record.get("anomaly_reason")),
                "merchant_median_amount": _optional_decimal(
                    record.get("merchant_median_amount"), 2
                ),
                "merchant_amount_ratio": _optional_decimal(
                    record.get("merchant_amount_ratio"), 4, MAX_RATIO
                ),
            }
        )
    return rows


def save_dataset(
    db: Session,
    user_id: UUID,
    *,
    filename: str,
    transactions: pd.DataFrame,
    column_mapping: dict[str, str],
    amount_sign: str | None,
    content_hash: str,
) -> TransactionDataset:
    """Persist one processed import and make it the account's active dataset."""

    db.execute(
        update(TransactionDataset)
        .where(
            TransactionDataset.user_id == user_id,
            TransactionDataset.is_active.is_(True),
        )
        .values(is_active=False)
    )

    dataset = TransactionDataset(
        user_id=user_id,
        original_filename=filename[:255],
        transaction_count=len(transactions),
        column_mapping=column_mapping,
        amount_sign=amount_sign or "purchase_positive",
        content_hash=content_hash,
        is_active=True,
    )
    db.add(dataset)
    db.flush()

    rows = _transaction_rows(transactions, user_id, dataset.id)
    if rows:
        db.execute(insert(FinanceTransaction), rows)

    db.commit()
    db.refresh(dataset)
    return dataset


def get_dataset(
    db: Session,
    user_id: UUID,
    dataset_id: str | UUID,
) -> TransactionDataset | None:
    """Return a dataset only when it belongs to the authenticated user."""

    try:
        identifier = UUID(str(dataset_id))
    except (AttributeError, ValueError):
        return None
    return db.scalar(
        select(TransactionDataset).where(
            TransactionDataset.id == identifier,
            TransactionDataset.user_id == user_id,
        )
    )


def get_active_dataset(db: Session, user_id: UUID) -> TransactionDataset | None:
    return db.scalar(
        select(TransactionDataset).where(
            TransactionDataset.user_id == user_id,
            TransactionDataset.is_active.is_(True),
        )
    )


def find_dataset_by_hash(
    db: Session,
    user_id: UUID,
    content_hash: str,
) -> TransactionDataset | None:
    return db.scalar(
        select(TransactionDataset).where(
            TransactionDataset.user_id == user_id,
            TransactionDataset.content_hash == content_hash,
        )
    )


def list_datasets(db: Session, user_id: UUID) -> list[TransactionDataset]:
    return list(
        db.scalars(
            select(TransactionDataset)
            .where(TransactionDataset.user_id == user_id)
            .order_by(TransactionDataset.created_at.desc())
        )
    )


def activate_dataset(db: Session, dataset: TransactionDataset) -> TransactionDataset:
    """Make an already-owned dataset the one the dashboard reads from."""

    if not dataset.is_active:
        db.execute(
            update(TransactionDataset)
            .where(
                TransactionDataset.user_id == dataset.user_id,
                TransactionDataset.is_active.is_(True),
            )
            .values(is_active=False)
        )
        dataset.is_active = True
        db.commit()
        db.refresh(dataset)
    return dataset


def delete_dataset(db: Session, user_id: UUID, dataset_id: str | UUID) -> bool:
    """Delete an owned dataset and, by cascade, its stored transactions."""

    dataset = get_dataset(db, user_id, dataset_id)
    if dataset is None:
        return False

    was_active = dataset.is_active
    db.execute(
        delete(FinanceTransaction).where(
            FinanceTransaction.dataset_id == dataset.id,
            FinanceTransaction.user_id == user_id,
        )
    )
    db.delete(dataset)
    db.commit()

    if was_active:
        # Fall back to the most recent remaining import rather than the demo data.
        replacement = db.scalar(
            select(TransactionDataset)
            .where(TransactionDataset.user_id == user_id)
            .order_by(TransactionDataset.created_at.desc())
            .limit(1)
        )
        if replacement is not None:
            replacement.is_active = True
            db.commit()
    return True


def load_transactions_frame(
    db: Session,
    user_id: UUID,
    dataset_id: UUID,
) -> pd.DataFrame:
    """Rebuild the analytics DataFrame from one user's stored transactions."""

    rows = db.execute(
        select(
            FinanceTransaction.date,
            FinanceTransaction.description_raw,
            FinanceTransaction.description_clean,
            FinanceTransaction.merchant,
            FinanceTransaction.amount,
            FinanceTransaction.category,
            FinanceTransaction.category_confidence,
            FinanceTransaction.is_anomaly_candidate,
            FinanceTransaction.is_anomaly,
            FinanceTransaction.anomaly_score,
            FinanceTransaction.anomaly_reason,
            FinanceTransaction.merchant_median_amount,
            FinanceTransaction.merchant_amount_ratio,
        )
        .where(
            FinanceTransaction.user_id == user_id,
            FinanceTransaction.dataset_id == dataset_id,
        )
        .order_by(FinanceTransaction.date)
    ).all()

    frame = pd.DataFrame(rows, columns=list(FRAME_COLUMNS))
    if frame.empty:
        return frame

    frame["date"] = pd.to_datetime(frame["date"])
    numeric_columns = [
        "amount",
        "category_confidence",
        "anomaly_score",
        "merchant_median_amount",
        "merchant_amount_ratio",
    ]
    for column in numeric_columns:
        frame[column] = pd.to_numeric(frame[column], errors="coerce")
    frame["is_anomaly"] = frame["is_anomaly"].astype(bool)
    frame["is_anomaly_candidate"] = frame["is_anomaly_candidate"].astype(bool)
    return frame
