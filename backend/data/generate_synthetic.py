from pathlib import Path
from datetime import datetime, timedelta

import numpy as np
import pandas as pd


RANDOM_SEED = 42
NUMBER_OF_TRANSACTIONS = 500


MERCHANTS = {
    "Dining": {
        "CHIPOTLE 1432": (8, 25),
        "STARBUCKS STORE 12931": (4, 15),
        "MCDONALDS F3812": (6, 20),
        "DUNKIN 349832": (3, 14),
        "PANERA BREAD 2918": (8, 25),
        "TACO BELL 3982": (5, 18),
    },

    "Groceries": {
        "SHOPRITE #441": (35, 130),
        "WHOLE FOODS MARKET": (30, 140),
        "TRADER JOES #551": (25, 110),
        "ALDI #128": (20, 100),
        "KROGER #912": (30, 130),
        "COSTCO WHOLESALE": (40, 180),
    },

    "Entertainment": {
        "NETFLIX.COM": (15, 25),
        "SPOTIFY USA": (10, 20),
        "HULU": (10, 25),
        "DISNEY PLUS": (10, 25),
        "MAX STREAMING": (10, 25),
        "APPLE MUSIC": (8, 20),
    },

    "Fuel": {
        "EXXON 57291": (30, 75),
        "SHELL OIL 88321": (30, 75),
        "BP GAS STATION 2281": (30, 75),
        "CHEVRON 5812": (30, 75),
        "MOBIL 29182": (30, 75),
        "SPEEDWAY 8912": (25, 70),
    },

    "Shopping": {
        "AMZN MKTP US": (10, 120),
        "AMAZON MARKETPLACE": (10, 120),
        "TARGET STORE 1192": (15, 150),
        "BEST BUY 882": (20, 250),
        "ETSY.COM": (10, 100),
        "EBAY COMMERCE": (10, 150),
    },
}


CATEGORY_PROBABILITIES = {
    "Dining": 0.30,
    "Groceries": 0.22,
    "Entertainment": 0.12,
    "Fuel": 0.16,
    "Shopping": 0.20,
}


def generate_transactions(
    n_transactions=NUMBER_OF_TRANSACTIONS,
    random_seed=RANDOM_SEED,
    anomaly_count=10,
):
    """
    Generate synthetic personal-finance transactions.

    Parameters
    ----------
    n_transactions:
        Number of transactions to generate.

    random_seed:
        Controls reproducibility. Different seeds create
        different datasets.

    anomaly_count:
        Number of intentionally unusual transactions
        injected into the dataset.
    """

    rng = np.random.default_rng(
        random_seed
    )

    categories = list(
        CATEGORY_PROBABILITIES.keys()
    )

    probabilities = list(
        CATEGORY_PROBABILITIES.values()
    )

    start_date = datetime(
        2026,
        2,
        1,
    )

    rows = []

    for _ in range(n_transactions):

        category = rng.choice(
            categories,
            p=probabilities,
        )

        merchant_options = list(
            MERCHANTS[category].keys()
        )

        description = rng.choice(
            merchant_options
        )

        low, high = MERCHANTS[
            category
        ][description]

        amount = round(
            rng.uniform(
                low,
                high,
            ),
            2,
        )

        days_from_start = int(
            rng.integers(
                0,
                180,
            )
        )

        transaction_date = (
            start_date
            + timedelta(
                days=days_from_start
            )
        )

        rows.append(
            {
                "Date": transaction_date.strftime(
                    "%Y-%m-%d"
                ),
                "Description": description,
                "Amount": amount,
                "true_category": category,
                "true_anomaly": 0,
            }
        )

    df = pd.DataFrame(
        rows
    )

    # -----------------------------------------------------
    # Inject intentionally unusual transactions
    # -----------------------------------------------------

    anomaly_count = min(
        anomaly_count,
        len(df),
    )

    anomaly_indexes = rng.choice(
        df.index,
        size=anomaly_count,
        replace=False,
    )

    for index in anomaly_indexes:

        multiplier = rng.uniform(
            4,
            8,
        )

        df.loc[
            index,
            "Amount"
        ] = round(
            df.loc[
                index,
                "Amount"
            ]
            * multiplier,
            2,
        )

        df.loc[
            index,
            "true_anomaly"
        ] = 1

    df = (
        df
        .sort_values("Date")
        .reset_index(drop=True)
    )

    return df


if __name__ == "__main__":

    output_file = (
        Path(__file__)
        .resolve()
        .parent
        / "raw"
        / "transactions.csv"
    )

    df = generate_transactions()

    df.to_csv(
        output_file,
        index=False,
    )

    print(
        "Synthetic transaction dataset created."
    )

    print(
        f"Transactions: {len(df)}"
    )

    print(
        f"Categories: "
        f"{df['true_category'].nunique()}"
    )

    print(
        f"Injected anomalies: "
        f"{df['true_anomaly'].sum()}"
    )

    print(
        f"\nSaved to:\n{output_file}"
    )

    print(
        "\nCategory distribution:"
    )

    print(
        df["true_category"]
        .value_counts()
    )

    print(
        "\nFirst 10 transactions:"
    )

    print(
        df.head(10).to_string(
            index=False
        )
    )