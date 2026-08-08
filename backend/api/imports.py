from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from threading import Lock
from uuid import uuid4

import joblib
import pandas as pd
from sentence_transformers import SentenceTransformer

from backend.analytics.spending import build_spending_analytics
from backend.ml.anomaly_detection import MODEL_FILE, predict_anomalies
from backend.ml.categorize import CLASSIFIER_FILE, predict_categories
from backend.ml.embeddings import MODEL_NAME
from backend.pipeline.clean import clean_transactions


MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_TRANSACTION_ROWS = 10_000

DATE_ALIASES = ("date", "transaction date", "posted date", "posting date")
DESCRIPTION_ALIASES = ("description", "merchant", "name", "payee", "details")
AMOUNT_ALIASES = ("amount",)
DEBIT_ALIASES = ("debit", "debit amount")


class ImportValidationError(ValueError):
    """An uploaded CSV cannot be safely converted into transactions."""


@dataclass
class ImportedDataset:
    dataset_id: str
    filename: str
    transactions: pd.DataFrame
    analytics: dict


_datasets: dict[str, ImportedDataset] = {}
_datasets_lock = Lock()


def _normalized_columns(df: pd.DataFrame) -> dict[str, str]:
    normalized: dict[str, str] = {}
    for column in df.columns:
        key = " ".join(str(column).strip().lower().split())
        if key in normalized:
            raise ImportValidationError(
                f"The CSV contains duplicate column names matching '{key}'."
            )
        normalized[key] = str(column)
    return normalized


def _find_column(columns: dict[str, str], aliases: tuple[str, ...]) -> str | None:
    matches = [columns[alias] for alias in aliases if alias in columns]
    if len(matches) > 1:
        raise ImportValidationError(
            "Multiple columns match the same required transaction field: "
            + ", ".join(matches)
        )
    return matches[0] if matches else None


def parse_transaction_csv(
    content: bytes,
    *,
    amount_sign: str | None,
) -> tuple[pd.DataFrame, dict[str, str]]:
    if not content:
        raise ImportValidationError("The uploaded CSV is empty.")
    if len(content) > MAX_UPLOAD_BYTES:
        raise ImportValidationError("The CSV exceeds the 5 MB upload limit.")

    try:
        raw = pd.read_csv(BytesIO(content))
    except (UnicodeDecodeError, pd.errors.ParserError) as exc:
        raise ImportValidationError(
            "The file could not be read as a UTF-8 CSV."
        ) from exc

    if raw.empty:
        raise ImportValidationError("The CSV does not contain any transactions.")
    if len(raw) > MAX_TRANSACTION_ROWS:
        raise ImportValidationError(
            f"The CSV exceeds the {MAX_TRANSACTION_ROWS:,}-transaction limit."
        )

    columns = _normalized_columns(raw)
    date_column = _find_column(columns, DATE_ALIASES)
    description_column = _find_column(columns, DESCRIPTION_ALIASES)
    amount_column = _find_column(columns, AMOUNT_ALIASES)
    debit_column = _find_column(columns, DEBIT_ALIASES)

    if not date_column or not description_column:
        raise ImportValidationError(
            "The CSV must include a date column and a description/merchant column."
        )
    if amount_column and debit_column:
        raise ImportValidationError(
            "Both Amount and Debit columns were found. Remove one or map them explicitly."
        )
    if not amount_column and not debit_column:
        raise ImportValidationError(
            "The CSV must include an Amount, Debit, or Debit Amount column."
        )

    source_amount = amount_column or debit_column
    amounts = pd.to_numeric(
        raw[source_amount].astype(str).str.replace(r"[$,]", "", regex=True),
        errors="coerce",
    )

    if amount_column:
        if amount_sign not in {"purchase_positive", "purchase_negative"}:
            raise ImportValidationError(
                "Amount columns require amount_sign='purchase_positive' or "
                "amount_sign='purchase_negative'."
            )
        if amount_sign == "purchase_negative":
            amounts = -amounts
    elif amount_sign not in {None, "purchase_positive"}:
        raise ImportValidationError(
            "Debit columns already represent purchases as positive amounts."
        )

    canonical = pd.DataFrame(
        {
            "Date": raw[date_column],
            "Description": raw[description_column],
            "Amount": amounts,
        }
    )
    invalid_rows = canonical[["Date", "Description", "Amount"]].isna().any(axis=1)
    if invalid_rows.any():
        raise ImportValidationError(
            f"{int(invalid_rows.sum())} row(s) have a missing or invalid required value."
        )

    mapping = {
        "date": date_column,
        "description": description_column,
        "amount": source_amount,
    }
    return canonical, mapping


def process_upload(
    content: bytes,
    *,
    filename: str,
    amount_sign: str | None,
) -> tuple[ImportedDataset, dict[str, str]]:
    canonical, mapping = parse_transaction_csv(content, amount_sign=amount_sign)
    cleaned = clean_transactions(canonical)
    if cleaned.empty:
        raise ImportValidationError(
            "No valid transactions remained after cleaning the CSV."
        )

    classifier = joblib.load(CLASSIFIER_FILE)
    encoder = SentenceTransformer(MODEL_NAME, local_files_only=True)
    categorized = predict_categories(cleaned, classifier, encoder)

    anomaly_model = joblib.load(MODEL_FILE)
    transactions = predict_anomalies(categorized, anomaly_model)
    analytics = build_spending_analytics(transactions)

    dataset = ImportedDataset(
        dataset_id=str(uuid4()),
        filename=filename,
        transactions=transactions,
        analytics=analytics,
    )
    with _datasets_lock:
        _datasets[dataset.dataset_id] = dataset

    return dataset, mapping


def get_imported_dataset(dataset_id: str) -> ImportedDataset | None:
    with _datasets_lock:
        return _datasets.get(dataset_id)
