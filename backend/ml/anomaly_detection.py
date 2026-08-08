from pathlib import Path
import argparse
import json

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest


# ---------------------------------------------------------
# Paths
# ---------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[2]

PROCESSED_DIR = PROJECT_ROOT / "backend" / "data" / "processed"
MODEL_DIR = PROJECT_ROOT / "backend" / "models"

OUTPUT_FILE = PROCESSED_DIR / "transactions_anomalies.csv"
MODEL_FILE = MODEL_DIR / "anomaly_detector.joblib"
METADATA_FILE = MODEL_DIR / "anomaly_detector_metadata.json"


# ---------------------------------------------------------
# Find the most useful transaction file
# ---------------------------------------------------------

def find_input_file(explicit_input=None):
    if explicit_input:
        path = Path(explicit_input)

        if not path.is_absolute():
            path = PROJECT_ROOT / path

        if not path.exists():
            raise FileNotFoundError(f"Input file not found: {path}")

        return path

    preferred_files = [
        PROCESSED_DIR / "transactions_categorized.csv",
        PROCESSED_DIR / "transactions_semantic_categorized.csv",
        PROCESSED_DIR / "transactions_semantic.csv",
        PROCESSED_DIR / "transactions_with_categories.csv",
    ]

    for path in preferred_files:
        if path.exists():
            return path

    # Try to find any categorized transaction file.
    category_files = sorted(
        PROCESSED_DIR.glob("*categor*.csv"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )

    if category_files:
        return category_files[0]

    # Safe fallback to the cleaned transaction dataset.
    clean_file = PROCESSED_DIR / "transactions_clean.csv"

    if clean_file.exists():
        return clean_file

    raise FileNotFoundError(
        "Could not find a processed transaction file in "
        f"{PROCESSED_DIR}"
    )


# ---------------------------------------------------------
# Detect useful columns
# ---------------------------------------------------------

def detect_merchant_column(df):
    candidates = [
        "merchant",
        "merchant_normalized",
        "normalized_merchant",
        "description_clean",
        "description_raw",
    ]

    for column in candidates:
        if column in df.columns:
            return column

    raise ValueError(
        "Could not find a merchant or description column."
    )


def detect_category_column(df):
    candidates = [
        "category",
        "semantic_category",
        "predicted_category",
        "category_semantic",
        "final_category",
        "transaction_category",
    ]

    for column in candidates:
        if column in df.columns:
            return column

    # Last-resort automatic detection
    for column in df.columns:
        if "category" in column.lower():
            return column

    return None


# ---------------------------------------------------------
# Feature engineering
# ---------------------------------------------------------

def build_anomaly_features(df):
    """
    Build merchant-centered features for anomaly detection.

    V2 focuses on whether a transaction amount is unusual
    compared with that merchant's normal spending pattern.
    """

    work = df.copy()

    if "date" not in work.columns:
        raise ValueError("Dataset must contain a 'date' column.")

    if "amount" not in work.columns:
        raise ValueError("Dataset must contain an 'amount' column.")

    work["date"] = pd.to_datetime(
        work["date"],
        errors="coerce",
    )

    work["amount"] = pd.to_numeric(
        work["amount"],
        errors="coerce",
    )

    starting_rows = len(work)

    work = work.dropna(
        subset=["date", "amount"]
    ).copy()

    removed_rows = starting_rows - len(work)

    if removed_rows:
        print(
            f"Removed {removed_rows} rows with invalid "
            "date/amount values."
        )

    merchant_col = detect_merchant_column(work)
    category_col = detect_category_column(work)

    # -----------------------------------------------------
    # Basic amount information
    # -----------------------------------------------------

    work["amount_abs"] = work["amount"].abs()

    work["log_amount"] = np.log1p(
        work["amount_abs"]
    )

    # -----------------------------------------------------
    # Merchant normalization
    # -----------------------------------------------------

    work["_merchant_for_anomaly"] = (
        work[merchant_col]
        .fillna("unknown")
        .astype(str)
        .str.strip()
        .str.lower()
    )

    if category_col:
        work["_category_for_anomaly"] = (
            work[category_col]
            .fillna("uncategorized")
            .astype(str)
            .str.strip()
            .str.lower()
        )
    else:
        work["_category_for_anomaly"] = "uncategorized"

    total_rows = len(work)

    merchant_counts = (
        work["_merchant_for_anomaly"]
        .value_counts()
    )

    work["merchant_frequency"] = (
        work["_merchant_for_anomaly"]
        .map(merchant_counts)
        .fillna(0)
        / total_rows
    )

    # -----------------------------------------------------
    # Merchant-specific spending baseline
    # -----------------------------------------------------

    merchant_median = (
        work.groupby("_merchant_for_anomaly")["amount_abs"]
        .transform("median")
    )

    merchant_median = merchant_median.replace(
        0,
        np.nan,
    )

    overall_median = work["amount_abs"].median()

    if overall_median <= 0:
        overall_median = 1.0

    merchant_median = merchant_median.fillna(
        overall_median
    )

    work["merchant_median_amount"] = merchant_median

    # Example:
    # normal Starbucks = $8
    # current Starbucks = $40
    # ratio = 5x
    work["merchant_amount_ratio"] = (
        work["amount_abs"]
        / merchant_median.clip(lower=1.0)
    )

    # Only emphasize unusually HIGH transactions.
    # Low-cost transactions should not become anomalies
    # simply because they are below the merchant median.
    work["merchant_high_ratio"] = (
        work["merchant_amount_ratio"]
        .clip(lower=1.0, upper=20.0)
    )

    # -----------------------------------------------------
    # Robust merchant deviation using MAD
    # -----------------------------------------------------

    def median_absolute_deviation(series):
        median = series.median()

        return (
            series.sub(median)
            .abs()
            .median()
        )

    merchant_mad = (
        work.groupby("_merchant_for_anomaly")["amount_abs"]
        .transform(median_absolute_deviation)
    )

    # MAD can be extremely small for recurring charges.
    # Give each merchant a reasonable minimum scale.
    minimum_scale = np.maximum(
        merchant_median * 0.15,
        2.0,
    )

    robust_scale = np.maximum(
        merchant_mad * 1.4826,
        minimum_scale,
    )

    positive_difference = (
        work["amount_abs"]
        - merchant_median
    ).clip(lower=0)

    work["merchant_positive_robust_z"] = (
        positive_difference
        / robust_scale
    ).clip(
        lower=0,
        upper=20,
    )

    # -----------------------------------------------------
    # Features used by Isolation Forest V2
    #
    # Notice that predicted category and calendar timing
    # no longer directly control the model.
    # -----------------------------------------------------

    feature_columns = [
        "log_amount",
        "merchant_frequency",
        "merchant_high_ratio",
        "merchant_positive_robust_z",
    ]

    features = (
        work[feature_columns]
        .replace([np.inf, -np.inf], np.nan)
        .fillna(0.0)
    )

    return (
        work,
        features,
        feature_columns,
        merchant_col,
        category_col,
    )
def add_anomaly_reasons(df):
    """
    Add human-readable explanations for flagged transactions.
    """

    work = df.copy()

    reasons = []

    for _, row in work.iterrows():

        if not row["is_anomaly"]:
            reasons.append("")
            continue

        merchant_ratio = row.get(
            "merchant_amount_ratio",
            1.0,
        )

        robust_z = row.get(
            "merchant_positive_robust_z",
            0.0,
        )

        merchant_median = row.get(
            "merchant_median_amount",
            0.0,
        )

        if merchant_ratio >= 2.0:
            reason = (
                f"amount is {merchant_ratio:.1f}x "
                f"this merchant's typical amount "
                f"(median ${merchant_median:.2f})"
            )

        elif robust_z >= 3:
            reason = (
                "amount is unusually high compared with "
                "this merchant's normal spending history"
            )

        else:
            reason = (
                "unusual transaction amount compared with "
                "the merchant's historical pattern"
            )

        reasons.append(reason)

    work["anomaly_reason"] = reasons

    return work
# ---------------------------------------------------------
# Train Isolation Forest
# ---------------------------------------------------------

def detect_anomalies(df):
    """
    Detect anomalous transactions using Isolation Forest
    plus a merchant-relative validation rule.
    """

    (
        work,
        features,
        feature_columns,
        merchant_col,
        category_col,
    ) = build_anomaly_features(df)

    # -----------------------------------------------------
    # Train Isolation Forest
    # -----------------------------------------------------

    model = IsolationForest(
        n_estimators=300,

        # Isolation Forest will identify approximately
        # the most unusual 3% of transactions as candidates.
        contamination=0.03,

        random_state=42,
        n_jobs=-1,
    )

    predictions = model.fit_predict(features)

    decision_scores = model.decision_function(
        features
    )

    # -----------------------------------------------------
    # Stage 1: ML anomaly candidates
    # -----------------------------------------------------

    # Isolation Forest returns:
    #  1 = normal
    # -1 = anomaly
    work["is_anomaly_candidate"] = (
        predictions == -1
    )

    # -----------------------------------------------------
    # Stage 2: Merchant-relative validation
    # -----------------------------------------------------

    # A transaction becomes a final anomaly only when:
    #
    # 1. Isolation Forest considers it unusual
    # AND
    # 2. The amount is at least 2x that merchant's
    #    normal median transaction amount.
    #
    # This removes false positives such as normal BP,
    # Starbucks, Dunkin, or Apple Music transactions
    # that may be statistically unusual but are still
    # reasonable for that merchant.

    work["is_anomaly"] = (
        work["is_anomaly_candidate"]
        & (
            work["merchant_amount_ratio"]
            >= 2.0
        )
    )

    # -----------------------------------------------------
    # Create human-readable anomaly score
    # -----------------------------------------------------

    # Isolation Forest decision_function:
    #
    # larger values = more normal
    # smaller values = more anomalous
    #
    # Reverse it so larger = more anomalous.
    raw_anomaly_score = -decision_scores

    minimum = raw_anomaly_score.min()
    maximum = raw_anomaly_score.max()

    if maximum > minimum:

        normalized_score = (
            100
            * (
                raw_anomaly_score
                - minimum
            )
            / (
                maximum
                - minimum
            )
        )

    else:

        normalized_score = np.zeros(
            len(raw_anomaly_score)
        )

    work["anomaly_score"] = np.round(
        normalized_score,
        1,
    )

    # -----------------------------------------------------
    # Add explanations
    # -----------------------------------------------------

    work = add_anomaly_reasons(work)

    # -----------------------------------------------------
    # Remove temporary internal columns
    # -----------------------------------------------------

    work = work.drop(
        columns=[
            "_merchant_for_anomaly",
            "_category_for_anomaly",
        ],
        errors="ignore",
    )

    # -----------------------------------------------------
    # Return results
    # -----------------------------------------------------

    return (
        work,
        model,
        feature_columns,
        merchant_col,
        category_col,
    )

# ---------------------------------------------------------
# Main
# ---------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description=(
            "Detect anomalous personal-finance transactions "
            "using Isolation Forest."
        )
    )

    parser.add_argument(
        "--input",
        type=str,
        default=None,
        help=(
            "Optional path to a processed transaction CSV. "
            "If omitted, the script finds the latest "
            "categorized transaction file automatically."
        ),
    )

    args = parser.parse_args()

    input_file = find_input_file(
        args.input
    )

    print("\nAnomaly Detection")
    print("-" * 60)

    print(f"Loading transactions from:\n{input_file}")

    df = pd.read_csv(input_file)

    print("\nTransaction file loaded successfully.")
    print(f"Rows: {len(df)}")
    print(f"Columns: {len(df.columns)}")

    (
        results,
        model,
        feature_columns,
        merchant_col,
        category_col,
    ) = detect_anomalies(df)

    PROCESSED_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    MODEL_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    results.to_csv(
        OUTPUT_FILE,
        index=False,
    )

    joblib.dump(
        model,
        MODEL_FILE,
    )

    metadata = {
        "model": "IsolationForest",
        "contamination": 0.03,
        "n_estimators": 300,
        "random_state": 42,
        "features": feature_columns,
        "merchant_column": merchant_col,
        "category_column": category_col,
        "training_rows": len(results),
    }

    with open(
        METADATA_FILE,
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            metadata,
            file,
            indent=2,
        )

    anomaly_count = int(
        results["is_anomaly"].sum()
    )

    anomaly_percent = (
        anomaly_count
        / len(results)
        * 100
    )

    print("\nModel trained successfully.")

    print(f"\nMerchant column: {merchant_col}")
    print(
        "Category column:",
        category_col or "not found",
    )

    print(f"\nTransactions analyzed: {len(results)}")
    print(f"Anomalies detected: {anomaly_count}")
    print(
        f"Anomaly percentage: "
        f"{anomaly_percent:.2f}%"
    )

    print("\nTop anomalous transactions:")
    print("-" * 60)

    display_columns = [
        column
        for column in [
            "date",
            "description_raw",
            "merchant",
            category_col,
            "amount",
            "anomaly_score",
            "anomaly_reason",
        ]
        if column
        and column in results.columns
    ]

    top_anomalies = (
        results[
            results["is_anomaly"]
        ]
        .sort_values(
            "anomaly_score",
            ascending=False,
        )
        .head(10)
    )

    if len(top_anomalies) > 0:
        print(
            top_anomalies[
                display_columns
            ].to_string(index=False)
        )
    else:
        print("No anomalies detected.")

    print(
        "\nAnomaly results saved to:\n"
        f"{OUTPUT_FILE}"
    )

    print(
        "\nTrained anomaly model saved to:\n"
        f"{MODEL_FILE}"
    )

    print(
        "\nModel metadata saved to:\n"
        f"{METADATA_FILE}"
    )


if __name__ == "__main__":
    main()