from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
import json
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


def _read_csv(content: bytes) -> pd.DataFrame:
    """Apply upload limits and parse CSV bytes without persisting them."""

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
    if len(raw.columns) > 100:
        raise ImportValidationError("The CSV exceeds the 100-column limit.")

    _normalized_columns(raw)
    return raw


def _suggest_column(
    columns: dict[str, str],
    aliases: tuple[str, ...],
) -> str | None:
    matches = [columns[alias] for alias in aliases if alias in columns]
    return matches[0] if len(matches) == 1 else None


def inspect_transaction_csv(content: bytes) -> dict:
    """Return safe metadata and suggestions before an import is processed."""

    raw = _read_csv(content)
    columns = _normalized_columns(raw)
    date_column = _suggest_column(columns, DATE_ALIASES)
    description_column = _suggest_column(columns, DESCRIPTION_ALIASES)
    amount_column = _suggest_column(columns, AMOUNT_ALIASES + DEBIT_ALIASES)

    warnings = []
    if not date_column:
        warnings.append("Confirm which column contains the transaction date.")
    if not description_column:
        warnings.append("Confirm which column contains the merchant or description.")
    if not amount_column:
        warnings.append("Confirm which column contains the purchase amount.")

    return {
        "columns": [str(column) for column in raw.columns],
        "row_count": len(raw),
        "suggested_mapping": {
            "date": date_column,
            "description": description_column,
            "amount": amount_column,
        },
        "preview": json.loads(raw.head(3).to_json(orient="records")),
        "warnings": warnings,
    }


def _selected_column(raw: pd.DataFrame, selected: str, field: str) -> str:
    if selected not in raw.columns:
        raise ImportValidationError(
            f"The selected {field} column '{selected}' was not found in the CSV."
        )
    return selected


def parse_transaction_csv(
    content: bytes,
    *,
    amount_sign: str | None,
    date_column: str | None = None,
    description_column: str | None = None,
    amount_column: str | None = None,
) -> tuple[pd.DataFrame, dict[str, str]]:
    raw = _read_csv(content)

    columns = _normalized_columns(raw)
    explicit_mapping = any((date_column, description_column, amount_column))
    if explicit_mapping:
        if not all((date_column, description_column, amount_column)):
            raise ImportValidationError(
                "Date, description, and amount mappings must all be provided."
            )
        date_column = _selected_column(raw, date_column, "date")
        description_column = _selected_column(raw, description_column, "description")
        source_amount = _selected_column(raw, amount_column, "amount")
        debit_column = (
            source_amount
            if " ".join(source_amount.strip().lower().split()) in DEBIT_ALIASES
            else None
        )
        amount_column = None if debit_column else source_amount
    else:
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
    date_column: str | None = None,
    description_column: str | None = None,
    amount_column: str | None = None,
) -> tuple[ImportedDataset, dict[str, str]]:
    canonical, mapping = parse_transaction_csv(
        content,
        amount_sign=amount_sign,
        date_column=date_column,
        description_column=description_column,
        amount_column=amount_column,
    )
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
