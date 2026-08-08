from pathlib import Path
import json

import pandas as pd


# ---------------------------------------------------------
# Paths
# ---------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[2]

INPUT_FILE = (
    PROJECT_ROOT
    / "backend"
    / "data"
    / "processed"
    / "transactions_anomalies.csv"
)

ANALYTICS_DIR = (
    PROJECT_ROOT
    / "backend"
    / "data"
    / "analytics"
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


# ---------------------------------------------------------
# Prepare transaction data
# ---------------------------------------------------------

def prepare_transactions(df: pd.DataFrame) -> pd.DataFrame:
    """
    Standardize transaction data before analytics.
    """

    work = df.copy()

    required_columns = [
        "date",
        "amount",
        "merchant",
    ]

    missing_columns = [
        column
        for column in required_columns
        if column not in work.columns
    ]

    if missing_columns:
        raise ValueError(
            "Missing required columns: "
            + ", ".join(missing_columns)
        )

    work["date"] = pd.to_datetime(
        work["date"],
        errors="coerce",
    )

    work["amount"] = pd.to_numeric(
        work["amount"],
        errors="coerce",
    )

    work = work.dropna(
        subset=[
            "date",
            "amount",
        ]
    ).copy()

    work["merchant"] = (
        work["merchant"]
        .fillna("Unknown")
        .astype(str)
    )

    if "category" not in work.columns:
        work["category"] = "Uncategorized"

    work["category"] = (
        work["category"]
        .fillna("Uncategorized")
        .astype(str)
    )

    if "is_anomaly" not in work.columns:
        work["is_anomaly"] = False

    if work["is_anomaly"].dtype != bool:
        work["is_anomaly"] = (
            work["is_anomaly"]
            .astype(str)
            .str.strip()
            .str.lower()
            .map(
                {
                    "true": True,
                    "false": False,
                    "1": True,
                    "0": False,
                }
            )
            .fillna(False)
        )

    work["month"] = (
        work["date"]
        .dt.to_period("M")
        .astype(str)
    )

    return work


# ---------------------------------------------------------
# Overall spending metrics
# ---------------------------------------------------------

def calculate_overall_metrics(
    df: pd.DataFrame,
) -> dict:
    """
    Calculate headline dashboard statistics.
    """

    transaction_count = len(df)

    total_spending = float(
        df["amount"].sum()
    )

    average_transaction = float(
        df["amount"].mean()
    )

    median_transaction = float(
        df["amount"].median()
    )

    largest_transaction = float(
        df["amount"].max()
    )

    anomaly_count = int(
        df["is_anomaly"].sum()
    )

    anomalous_spending = float(
        df.loc[
            df["is_anomaly"],
            "amount",
        ].sum()
    )

    anomaly_rate = (
        anomaly_count
        / transaction_count
        if transaction_count
        else 0
    )

    return {
        "transaction_count": transaction_count,
        "total_spending": round(
            total_spending,
            2,
        ),
        "average_transaction": round(
            average_transaction,
            2,
        ),
        "median_transaction": round(
            median_transaction,
            2,
        ),
        "largest_transaction": round(
            largest_transaction,
            2,
        ),
        "anomaly_count": anomaly_count,
        "anomaly_rate": round(
            anomaly_rate,
            4,
        ),
        "anomalous_spending": round(
            anomalous_spending,
            2,
        ),
    }


# ---------------------------------------------------------
# Monthly spending
# ---------------------------------------------------------

def calculate_monthly_spending(
    df: pd.DataFrame,
) -> pd.DataFrame:
    """
    Calculate spending totals by month.
    """

    monthly = (
        df.groupby(
            "month",
            as_index=False,
        )
        .agg(
            total_spending=(
                "amount",
                "sum",
            ),
            transaction_count=(
                "amount",
                "size",
            ),
            average_transaction=(
                "amount",
                "mean",
            ),
            anomaly_count=(
                "is_anomaly",
                "sum",
            ),
        )
        .sort_values("month")
        .reset_index(drop=True)
    )

    monthly[
        "total_spending"
    ] = monthly[
        "total_spending"
    ].round(2)

    monthly[
        "average_transaction"
    ] = monthly[
        "average_transaction"
    ].round(2)

    monthly[
        "month_over_month_change"
    ] = (
        monthly[
            "total_spending"
        ]
        .pct_change()
        .mul(100)
        .round(2)
    )

    return monthly


# ---------------------------------------------------------
# Category spending
# ---------------------------------------------------------

def calculate_category_spending(
    df: pd.DataFrame,
) -> pd.DataFrame:
    """
    Calculate spending by predicted transaction category.
    """

    category = (
        df.groupby(
            "category",
            as_index=False,
        )
        .agg(
            total_spending=(
                "amount",
                "sum",
            ),
            transaction_count=(
                "amount",
                "size",
            ),
            average_transaction=(
                "amount",
                "mean",
            ),
            anomaly_count=(
                "is_anomaly",
                "sum",
            ),
        )
        .sort_values(
            "total_spending",
            ascending=False,
        )
        .reset_index(drop=True)
    )

    category[
        "total_spending"
    ] = category[
        "total_spending"
    ].round(2)

    category[
        "average_transaction"
    ] = category[
        "average_transaction"
    ].round(2)

    total_spending = (
        category[
            "total_spending"
        ].sum()
    )

    if total_spending > 0:
        category[
            "spending_percentage"
        ] = (
            category[
                "total_spending"
            ]
            / total_spending
            * 100
        ).round(2)

    else:
        category[
            "spending_percentage"
        ] = 0.0

    return category


# ---------------------------------------------------------
# Merchant spending
# ---------------------------------------------------------

def calculate_merchant_spending(
    df: pd.DataFrame,
) -> pd.DataFrame:
    """
    Calculate spending statistics by merchant.
    """

    merchant = (
        df.groupby(
            "merchant",
            as_index=False,
        )
        .agg(
            total_spending=(
                "amount",
                "sum",
            ),
            transaction_count=(
                "amount",
                "size",
            ),
            average_transaction=(
                "amount",
                "mean",
            ),
            largest_transaction=(
                "amount",
                "max",
            ),
            anomaly_count=(
                "is_anomaly",
                "sum",
            ),
        )
        .sort_values(
            "total_spending",
            ascending=False,
        )
        .reset_index(drop=True)
    )

    numeric_columns = [
        "total_spending",
        "average_transaction",
        "largest_transaction",
    ]

    merchant[
        numeric_columns
    ] = merchant[
        numeric_columns
    ].round(2)

    return merchant


# ---------------------------------------------------------
# Anomaly analytics
# ---------------------------------------------------------

def calculate_anomaly_summary(
    df: pd.DataFrame,
) -> pd.DataFrame:
    """
    Return transactions marked as final anomalies.
    """

    anomaly_columns = [
        column
        for column in [
            "date",
            "merchant",
            "category",
            "amount",
            "anomaly_score",
            "merchant_median_amount",
            "merchant_amount_ratio",
            "anomaly_reason",
        ]
        if column in df.columns
    ]

    anomalies = (
        df[
            df["is_anomaly"]
        ][
            anomaly_columns
        ]
        .sort_values(
            "anomaly_score"
            if "anomaly_score"
            in anomaly_columns
            else "amount",
            ascending=False,
        )
        .reset_index(drop=True)
    )

    return anomalies


# ---------------------------------------------------------
# Largest transactions
# ---------------------------------------------------------

def get_largest_transactions(
    df: pd.DataFrame,
    limit: int = 10,
) -> pd.DataFrame:
    """
    Return the largest transactions.
    """

    columns = [
        column
        for column in [
            "date",
            "merchant",
            "category",
            "amount",
            "is_anomaly",
            "anomaly_score",
        ]
        if column in df.columns
    ]

    return (
        df.sort_values(
            "amount",
            ascending=False,
        )
        .head(limit)[columns]
        .reset_index(drop=True)
    )


# ---------------------------------------------------------
# Top merchants
# ---------------------------------------------------------

def get_top_merchants(
    merchant_df: pd.DataFrame,
    limit: int = 10,
) -> pd.DataFrame:
    """
    Return merchants with the most total spending.
    """

    return (
        merchant_df
        .head(limit)
        .reset_index(drop=True)
    )


# ---------------------------------------------------------
# Build complete analytics package
# ---------------------------------------------------------

def build_spending_analytics(
    df: pd.DataFrame,
):
    """
    Generate all spending analytics used by the dashboard.
    """

    prepared = prepare_transactions(df)

    summary = calculate_overall_metrics(
        prepared
    )

    monthly = calculate_monthly_spending(
        prepared
    )

    category = calculate_category_spending(
        prepared
    )

    merchant = calculate_merchant_spending(
        prepared
    )

    anomalies = calculate_anomaly_summary(
        prepared
    )

    largest_transactions = (
        get_largest_transactions(
            prepared
        )
    )

    top_merchants = get_top_merchants(
        merchant
    )

    return {
        "summary": summary,
        "monthly": monthly,
        "category": category,
        "merchant": merchant,
        "top_merchants": top_merchants,
        "largest_transactions": largest_transactions,
        "anomalies": anomalies,
    }


# ---------------------------------------------------------
# Main
# ---------------------------------------------------------

def main():

    print("\nSpending Analytics")
    print("=" * 60)

    print(
        "\nLoading transactions from:"
    )

    print(INPUT_FILE)

    if not INPUT_FILE.exists():
        raise FileNotFoundError(
            f"Input file not found: "
            f"{INPUT_FILE}"
        )

    df = pd.read_csv(
        INPUT_FILE
    )

    print(
        f"\nTransactions loaded: "
        f"{len(df)}"
    )

    analytics = (
        build_spending_analytics(df)
    )

    summary = analytics["summary"]
    monthly = analytics["monthly"]
    category = analytics["category"]
    merchant = analytics["merchant"]
    anomalies = analytics["anomalies"]

    # -----------------------------------------------------
    # Print headline metrics
    # -----------------------------------------------------

    print("\nOverall spending")
    print("-" * 60)

    print(
        f"Transactions: "
        f"{summary['transaction_count']}"
    )

    print(
        f"Total spending: "
        f"${summary['total_spending']:,.2f}"
    )

    print(
        f"Average transaction: "
        f"${summary['average_transaction']:,.2f}"
    )

    print(
        f"Median transaction: "
        f"${summary['median_transaction']:,.2f}"
    )

    print(
        f"Largest transaction: "
        f"${summary['largest_transaction']:,.2f}"
    )

    print(
        f"Anomalies: "
        f"{summary['anomaly_count']}"
    )

    print(
        f"Anomalous spending: "
        f"${summary['anomalous_spending']:,.2f}"
    )

    # -----------------------------------------------------
    # Print monthly analytics
    # -----------------------------------------------------

    print("\nMonthly spending")
    print("-" * 60)

    print(
        monthly.to_string(
            index=False
        )
    )

    # -----------------------------------------------------
    # Print category analytics
    # -----------------------------------------------------

    print("\nCategory spending")
    print("-" * 60)

    print(
        category.to_string(
            index=False
        )
    )

    # -----------------------------------------------------
    # Print top merchants
    # -----------------------------------------------------

    print("\nTop merchants")
    print("-" * 60)

    print(
        analytics[
            "top_merchants"
        ].to_string(
            index=False
        )
    )

    # -----------------------------------------------------
    # Print anomaly transactions
    # -----------------------------------------------------

    print("\nDetected anomalies")
    print("-" * 60)

    if len(anomalies) > 0:
        print(
            anomalies.to_string(
                index=False
            )
        )

    else:
        print(
            "No anomalies detected."
        )

    # -----------------------------------------------------
    # Save outputs
    # -----------------------------------------------------

    ANALYTICS_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    monthly.to_csv(
        MONTHLY_FILE,
        index=False,
    )

    category.to_csv(
        CATEGORY_FILE,
        index=False,
    )

    merchant.to_csv(
        MERCHANT_FILE,
        index=False,
    )

    anomalies.to_csv(
        ANOMALY_FILE,
        index=False,
    )

    with open(
        SUMMARY_FILE,
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            summary,
            file,
            indent=2,
        )

    print("\nAnalytics files saved to:")
    print(ANALYTICS_DIR)


if __name__ == "__main__":
    main()