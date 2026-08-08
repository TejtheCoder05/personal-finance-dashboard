from pathlib import Path
from typing import Annotated
import json

import pandas as pd

from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Query,
    Response,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.analytics.spending import build_spending_analytics
from backend.api.imports import (
    ImportValidationError,
    delete_imported_dataset,
    enrich_transactions,
    get_imported_dataset,
    inspect_transaction_csv,
    parse_transaction_csv,
    process_upload,
)
from backend.auth.dependencies import CurrentUser, OptionalUser
from backend.auth.router import router as auth_router
from backend.api.goals import router as goals_router
from backend.db import finance_store
from backend.db.database import get_db, get_optional_db
from backend.db.models import TransactionDataset, User


# ---------------------------------------------------------
# Project paths
# ---------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[2]

ANALYTICS_DIR = (
    PROJECT_ROOT
    / "backend"
    / "data"
    / "analytics"
)

PROCESSED_DIR = (
    PROJECT_ROOT
    / "backend"
    / "data"
    / "processed"
)

SUMMARY_FILE = (
    ANALYTICS_DIR
    / "spending_summary.json"
)

MONTHLY_FILE = (
    ANALYTICS_DIR
    / "monthly_spending.csv"
)

CATEGORY_FILE = (
    ANALYTICS_DIR
    / "category_spending.csv"
)

MERCHANT_FILE = (
    ANALYTICS_DIR
    / "merchant_spending.csv"
)

ANOMALY_FILE = (
    ANALYTICS_DIR
    / "anomaly_summary.csv"
)

TRANSACTIONS_FILE = (
    PROCESSED_DIR
    / "transactions_anomalies.csv"
)


# ---------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------

app = FastAPI(
    title="Personal Finance ML API",
    description=(
        "Backend API for transaction analytics, "
        "spending categorization, and anomaly detection."
    ),
    version="1.0.0",
)


# ---------------------------------------------------------
# CORS
# ---------------------------------------------------------

# Allows our future frontend to communicate with FastAPI.

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(goals_router)


# ---------------------------------------------------------
# Helper functions
# ---------------------------------------------------------

def load_json_file(path: Path):
    """
    Load a JSON analytics file.
    """

    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"{path.name} not found.",
        )

    with open(
        path,
        "r",
        encoding="utf-8",
    ) as file:
        return json.load(file)


def load_csv_file(path: Path):
    """
    Load a CSV file and convert it into JSON records.
    """

    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"{path.name} not found.",
        )

    df = pd.read_csv(path)

    return json.loads(
        df.to_json(
            orient="records",
            date_format="iso",
        )
    )


def get_dataset_or_404(dataset_id: str):
    dataset = get_imported_dataset(dataset_id)
    if dataset is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "Uploaded dataset not found. It may have expired because "
                "the backend restarted."
            ),
        )
    return dataset


def dataframe_records(df: pd.DataFrame):
    return json.loads(df.to_json(orient="records", date_format="iso"))


# ---------------------------------------------------------
# Request data source resolution
# ---------------------------------------------------------

OptionalDbSession = Annotated[Session | None, Depends(get_optional_db)]


class ResolvedSource:
    """Transactions for one request, with analytics computed only when needed."""

    def __init__(self, transactions: pd.DataFrame, analytics: dict | None = None):
        self.transactions = transactions
        self._analytics = analytics

    @property
    def analytics(self) -> dict:
        if self._analytics is None:
            self._analytics = build_spending_analytics(self.transactions)
        return self._analytics


def resolve_source(
    user: User | None,
    dataset_id: str | None,
    db: Session | None,
) -> ResolvedSource | None:
    """Resolve the dataset a request should read, or None for the demo dataset.

    Signed-in requests are answered from PostgreSQL and are always filtered by
    the authenticated user's id, so a dataset identifier alone never exposes
    another account's transactions.
    """

    if user is not None and db is not None:
        dataset = (
            finance_store.get_dataset(db, user.id, dataset_id)
            if dataset_id
            else finance_store.get_active_dataset(db, user.id)
        )
        if dataset is not None:
            return ResolvedSource(
                finance_store.load_transactions_frame(db, user.id, dataset.id)
            )

    if dataset_id:
        temporary = get_dataset_or_404(dataset_id)
        return ResolvedSource(temporary.transactions, temporary.analytics)
    return None


def dataset_payload(dataset: TransactionDataset) -> dict:
    return {
        "dataset_id": str(dataset.id),
        "filename": dataset.original_filename,
        "transaction_count": dataset.transaction_count,
        "column_mapping": dataset.column_mapping,
        "amount_sign": dataset.amount_sign,
        "is_active": dataset.is_active,
        "created_at": dataset.created_at.isoformat(),
        "storage": "account",
    }


# ---------------------------------------------------------
# Root
# ---------------------------------------------------------

@app.get("/")
def root():
    """
    Basic API information.
    """

    return {
        "name": "Personal Finance ML API",
        "status": "running",
        "version": "1.0.0",
    }


# ---------------------------------------------------------
# Health check
# ---------------------------------------------------------

@app.get("/health")
def health():
    """
    Confirm that the API and required data files exist.
    """

    required_files = [
        SUMMARY_FILE,
        MONTHLY_FILE,
        CATEGORY_FILE,
        MERCHANT_FILE,
        ANOMALY_FILE,
        TRANSACTIONS_FILE,
    ]

    missing_files = [
        path.name
        for path in required_files
        if not path.exists()
    ]

    if missing_files:
        return {
            "status": "degraded",
            "missing_files": missing_files,
        }

    return {
        "status": "healthy",
        "missing_files": [],
    }


# ---------------------------------------------------------
# Dashboard summary
# ---------------------------------------------------------

@app.get("/api/summary")
def get_summary(
    user: OptionalUser,
    db: OptionalDbSession,
    dataset_id: str | None = None,
):
    """
    Return headline spending statistics.
    """

    source = resolve_source(user, dataset_id, db)
    if source is not None:
        return source.analytics["summary"]
    return load_json_file(
        SUMMARY_FILE
    )


# ---------------------------------------------------------
# Monthly spending
# ---------------------------------------------------------

@app.get("/api/monthly")
def get_monthly_spending(
    user: OptionalUser,
    db: OptionalDbSession,
    dataset_id: str | None = None,
):
    """
    Return monthly spending and month-over-month changes.
    """

    source = resolve_source(user, dataset_id, db)
    if source is not None:
        return dataframe_records(source.analytics["monthly"])
    return load_csv_file(
        MONTHLY_FILE
    )


# ---------------------------------------------------------
# Category spending
# ---------------------------------------------------------

@app.get("/api/categories")
def get_category_spending(
    user: OptionalUser,
    db: OptionalDbSession,
    dataset_id: str | None = None,
):
    """
    Return spending grouped by category.
    """

    source = resolve_source(user, dataset_id, db)
    if source is not None:
        return dataframe_records(source.analytics["category"])
    return load_csv_file(
        CATEGORY_FILE
    )


# ---------------------------------------------------------
# Merchant spending
# ---------------------------------------------------------

@app.get("/api/merchants")
def get_merchants(
    user: OptionalUser,
    db: OptionalDbSession,
    limit: int = Query(
        default=10,
        ge=1,
        le=100,
    ),
    dataset_id: str | None = None,
):
    """
    Return merchants ranked by total spending.
    """

    source = resolve_source(user, dataset_id, db)
    if source is not None:
        records = dataframe_records(source.analytics["merchant"])
    else:
        records = load_csv_file(MERCHANT_FILE)

    return records[:limit]


# ---------------------------------------------------------
# Anomalies
# ---------------------------------------------------------

@app.get("/api/anomalies")
def get_anomalies(
    user: OptionalUser,
    db: OptionalDbSession,
    dataset_id: str | None = None,
):
    """
    Return transactions flagged as anomalies.
    """

    source = resolve_source(user, dataset_id, db)
    if source is not None:
        return dataframe_records(source.analytics["anomalies"])
    return load_csv_file(
        ANOMALY_FILE
    )


# ---------------------------------------------------------
# Transactions
# ---------------------------------------------------------

@app.get("/api/transactions")
def get_transactions(
    user: OptionalUser,
    db: OptionalDbSession,
    limit: int = Query(
        default=50,
        ge=1,
        le=500,
    ),
    category: str | None = None,
    anomalies_only: bool = False,
    dataset_id: str | None = None,
):
    """
    Return transactions with optional filters.
    """

    source = resolve_source(user, dataset_id, db)

    if source is not None:
        df = source.transactions.copy()
    elif not TRANSACTIONS_FILE.exists():
        raise HTTPException(
            status_code=404,
            detail="Transaction data not found.",
        )

    else:
        df = pd.read_csv(TRANSACTIONS_FILE)

    # -----------------------------------------------------
    # Filter by category
    # -----------------------------------------------------

    if category:

        df = df[
            df["category"]
            .astype(str)
            .str.lower()
            == category.lower()
        ]

    # -----------------------------------------------------
    # Filter anomalies
    # -----------------------------------------------------

    if anomalies_only:

        anomaly_values = (
            df["is_anomaly"]
            .astype(str)
            .str.strip()
            .str.lower()
        )

        df = df[
            anomaly_values == "true"
        ]

    # -----------------------------------------------------
    # Most recent transactions first
    # -----------------------------------------------------

    if "date" in df.columns:

        df["date"] = pd.to_datetime(
            df["date"],
            errors="coerce",
        )

        df = df.sort_values(
            "date",
            ascending=False,
        )

    # -----------------------------------------------------
    # Limit results
    # -----------------------------------------------------

    df = df.head(
        limit
    )

    return json.loads(
        df.to_json(
            orient="records",
            date_format="iso",
        )
    )


@app.post("/api/imports", status_code=201)
async def import_transactions(
    response: Response,
    user: OptionalUser,
    db: OptionalDbSession,
    file: UploadFile = File(...),
    amount_sign: str | None = Form(default=None),
    date_column: str | None = Form(default=None),
    description_column: str | None = Form(default=None),
    amount_column: str | None = Form(default=None),
):
    """Process a bank transaction CSV.

    Signed-in uploads are persisted to the authenticated account; anonymous
    demo uploads stay in temporary backend memory.
    """

    filename = file.filename or "transactions.csv"
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=415, detail="Only .csv files are supported.")

    content = await file.read()
    await file.close()

    if user is None or db is None:
        try:
            dataset, mapping = process_upload(
                content,
                filename=filename,
                amount_sign=amount_sign,
                date_column=date_column,
                description_column=description_column,
                amount_column=amount_column,
            )
        except ImportValidationError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except (FileNotFoundError, OSError) as exc:
            raise HTTPException(
                status_code=503,
                detail="A required saved ML model is unavailable.",
            ) from exc

        return {
            "dataset_id": dataset.dataset_id,
            "filename": dataset.filename,
            "transaction_count": len(dataset.transactions),
            "column_mapping": mapping,
            "storage": "temporary",
        }

    try:
        canonical, mapping = parse_transaction_csv(
            content,
            amount_sign=amount_sign,
            date_column=date_column,
            description_column=description_column,
            amount_column=amount_column,
        )
    except ImportValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    # Re-uploading an identical CSV reactivates the stored import instead of
    # duplicating every transaction in the account.
    content_hash = finance_store.dataset_fingerprint(content, mapping, amount_sign)
    existing = finance_store.find_dataset_by_hash(db, user.id, content_hash)
    if existing is not None:
        response.status_code = 200
        return dataset_payload(finance_store.activate_dataset(db, existing))

    try:
        transactions = enrich_transactions(canonical)
    except ImportValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except (FileNotFoundError, OSError) as exc:
        raise HTTPException(
            status_code=503,
            detail="A required saved ML model is unavailable.",
        ) from exc

    try:
        dataset = finance_store.save_dataset(
            db,
            user.id,
            filename=filename,
            transactions=transactions,
            column_mapping=mapping,
            amount_sign=amount_sign,
            content_hash=content_hash,
        )
    except IntegrityError:
        # A concurrent identical upload won the race; reuse what it stored.
        db.rollback()
        existing = finance_store.find_dataset_by_hash(db, user.id, content_hash)
        if existing is None:
            raise
        response.status_code = 200
        return dataset_payload(finance_store.activate_dataset(db, existing))

    return dataset_payload(dataset)


@app.get("/api/imports")
def list_transaction_imports(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    """List the authenticated user's stored imports, newest first."""

    return [
        dataset_payload(dataset)
        for dataset in finance_store.list_datasets(db, current_user.id)
    ]


@app.post("/api/imports/validate")
async def validate_transaction_import(file: UploadFile = File(...)):
    """Inspect a CSV and suggest canonical transaction column mappings."""

    filename = file.filename or "transactions.csv"
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=415, detail="Only .csv files are supported.")

    content = await file.read()
    await file.close()
    try:
        inspection = inspect_transaction_csv(content)
    except ImportValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return {"filename": filename, **inspection}


@app.delete("/api/imports/{dataset_id}", status_code=204)
def delete_transaction_import(
    dataset_id: str,
    user: OptionalUser,
    db: OptionalDbSession,
):
    """Permanently remove an imported dataset and its stored transactions."""

    if user is not None and db is not None:
        if finance_store.delete_dataset(db, user.id, dataset_id):
            return Response(status_code=204)

    if delete_imported_dataset(dataset_id):
        return Response(status_code=204)
    raise HTTPException(status_code=404, detail="Uploaded dataset not found.")
