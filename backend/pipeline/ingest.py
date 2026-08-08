from pathlib import Path

import pandas as pd


REQUIRED_COLUMNS = [
    "Date",
    "Description",
    "Amount",
]


def load_transactions(file_path: str | Path) -> pd.DataFrame:
    """
    Load and validate transaction data from a CSV file.
    """

    file_path = Path(file_path)

    # Make sure the transaction file exists.
    if not file_path.exists():
        raise FileNotFoundError(
            f"Transaction file does not exist: {file_path}"
        )

    # Load the CSV into a pandas DataFrame.
    df = pd.read_csv(file_path)

    # Check that required transaction columns exist.
    missing_columns = [
        column
        for column in REQUIRED_COLUMNS
        if column not in df.columns
    ]

    if missing_columns:
        raise ValueError(
            f"Missing required columns: {missing_columns}"
        )

    print("Transaction file loaded successfully.")
    print(f"Rows: {len(df)}")
    print(f"Columns: {len(df.columns)}")

    return df


if __name__ == "__main__":
    project_root = Path(__file__).resolve().parents[2]

    transaction_file = (
        project_root
        / "backend"
        / "data"
        / "raw"
        / "transactions.csv"
    )

    transactions = load_transactions(transaction_file)

    print("\nFirst 5 transactions:")
    print(transactions.head())