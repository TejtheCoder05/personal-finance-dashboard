from pathlib import Path

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer


def build_text_features(df: pd.DataFrame):
    """
    Convert cleaned transaction descriptions into
    numerical TF-IDF features.
    """

    vectorizer = TfidfVectorizer(
        stop_words="english",
        ngram_range=(1, 2),
        min_df=2,
    )

    X = vectorizer.fit_transform(
        df["description_clean"]
    )

    return X, vectorizer


if __name__ == "__main__":
    project_root = Path(__file__).resolve().parents[2]

    processed_file = (
        project_root
        / "backend"
        / "data"
        / "processed"
        / "transactions_clean.csv"
    )

    df = pd.read_csv(processed_file)

    X, vectorizer = build_text_features(df)

    feature_names = vectorizer.get_feature_names_out()

    print("TF-IDF feature generation successful.")

    print(f"\nTransactions: {X.shape[0]}")
    print(f"Features created: {X.shape[1]}")

    print("\nExample features:")
    for feature in feature_names[:20]:
        print(feature)

    print("\nFirst transaction:")
    print(df.loc[0, "description_clean"])

    print("\nNumerical representation:")
    print(X[0])