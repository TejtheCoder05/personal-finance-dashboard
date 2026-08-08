from pathlib import Path
import json

import pandas as pd

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware


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
def get_summary():
    """
    Return headline spending statistics.
    """

    return load_json_file(
        SUMMARY_FILE
    )


# ---------------------------------------------------------
# Monthly spending
# ---------------------------------------------------------

@app.get("/api/monthly")
def get_monthly_spending():
    """
    Return monthly spending and month-over-month changes.
    """

    return load_csv_file(
        MONTHLY_FILE
    )


# ---------------------------------------------------------
# Category spending
# ---------------------------------------------------------

@app.get("/api/categories")
def get_category_spending():
    """
    Return spending grouped by category.
    """

    return load_csv_file(
        CATEGORY_FILE
    )


# ---------------------------------------------------------
# Merchant spending
# ---------------------------------------------------------

@app.get("/api/merchants")
def get_merchants(
    limit: int = Query(
        default=10,
        ge=1,
        le=100,
    ),
):
    """
    Return merchants ranked by total spending.
    """

    records = load_csv_file(
        MERCHANT_FILE
    )

    return records[:limit]


# ---------------------------------------------------------
# Anomalies
# ---------------------------------------------------------

@app.get("/api/anomalies")
def get_anomalies():
    """
    Return transactions flagged as anomalies.
    """

    return load_csv_file(
        ANOMALY_FILE
    )


# ---------------------------------------------------------
# Transactions
# ---------------------------------------------------------

@app.get("/api/transactions")
def get_transactions(
    limit: int = Query(
        default=50,
        ge=1,
        le=500,
    ),
    category: str | None = None,
    anomalies_only: bool = False,
):
    """
    Return transactions with optional filters.
    """

    if not TRANSACTIONS_FILE.exists():
        raise HTTPException(
            status_code=404,
            detail="Transaction data not found.",
        )

    df = pd.read_csv(
        TRANSACTIONS_FILE
    )

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