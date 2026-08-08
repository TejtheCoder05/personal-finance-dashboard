from pathlib import Path
import re

import pandas as pd

from backend.pipeline.ingest import load_transactions
from backend.pipeline.merchant import normalize_merchant


def clean_description(description: str) -> str:
    """
    Normalize a raw transaction description.
    """

    if pd.isna(description):
        return ""

    description = str(description).lower()

    # Remove numbers such as store IDs.
    description = re.sub(r"\d+", " ", description)

    # Remove punctuation and symbols.
    description = re.sub(r"[^a-z\s]", " ", description)

    # Replace repeated spaces with one space.
    description = re.sub(r"\s+", " ", description)

    return description.strip()


def clean_transactions(df: pd.DataFrame) -> pd.DataFrame:
    """
    Clean and standardize raw transaction data.
    """

    df = df.copy()

    print(f"Starting rows: {len(df)}")

    # Standardize column names.
    df = df.rename(
        columns={
            "Date": "date",
            "Description": "description_raw",
            "Amount": "amount",
        }
    )

    # Convert dates.
    df["date"] = pd.to_datetime(
        df["date"],
        errors="coerce",
    )

    # Convert amounts.
    df["amount"] = pd.to_numeric(
        df["amount"],
        errors="coerce",
    )

    # Clean bank descriptions.
    df["description_clean"] = (
        df["description_raw"]
        .apply(clean_description)
    )

    # Create normalized merchant names.
    df["merchant"] = (
        df["description_clean"]
        .apply(normalize_merchant)
    )

    # Remove invalid dates or amounts.
    df = df.dropna(
        subset=[
            "date",
            "amount",
        ]
    )

    # Remove empty descriptions or merchants.
    df = df[
        (df["description_clean"] != "")
        & (df["merchant"] != "")
    ]

    # Remove duplicate transactions.
    before_duplicates = len(df)

    df = df.drop_duplicates(
        subset=[
            "date",
            "description_raw",
            "amount",
        ]
    )

    duplicates_removed = (
        before_duplicates - len(df)
    )

    # Date-based ML features.
    df["month"] = df["date"].dt.month
    df["day_of_week"] = df["date"].dt.dayofweek
    df["day_of_month"] = df["date"].dt.day

    # Sort oldest to newest.
    df = (
        df
        .sort_values("date")
        .reset_index(drop=True)
    )

    print(f"Duplicates removed: {duplicates_removed}")
    print(f"Final rows: {len(df)}")

    return df


if __name__ == "__main__":

    project_root = Path(__file__).resolve().parents[2]

    raw_file = (
        project_root
        / "backend"
        / "data"
        / "raw"
        / "transactions.csv"
    )

    processed_file = (
        project_root
        / "backend"
        / "data"
        / "processed"
        / "transactions_clean.csv"
    )

    raw_transactions = load_transactions(raw_file)

    clean_df = clean_transactions(
        raw_transactions
    )

    clean_df.to_csv(
        processed_file,
        index=False,
    )

    print(
        f"\nCleaned transactions saved to:\n"
        f"{processed_file}"
    )

    print("\nFirst 10 cleaned transactions:")

    print(
        clean_df[
            [
                "date",
                "description_raw",
                "description_clean",
                "merchant",
                "amount",
            ]
        ].head(10)
    )