from pathlib import Path
import sys

import pandas as pd
from sentence_transformers import SentenceTransformer


MODEL_NAME = "all-MiniLM-L6-v2"


def download_encoder() -> SentenceTransformer:
    """Fetch the sentence encoder into the local cache.

    Request-time code loads the encoder with ``local_files_only=True`` so an
    import never depends on the network. Run this once per machine, image, or
    CI job before serving traffic:

        python -m backend.ml.embeddings --download
    """

    return SentenceTransformer(MODEL_NAME)


def build_semantic_features(
    df: pd.DataFrame,
    text_column: str = "description_clean",
):
    """
    Convert transaction text into semantic embeddings.
    """

    model = SentenceTransformer(MODEL_NAME)

    texts = (
        df[text_column]
        .fillna("")
        .tolist()
    )

    embeddings = model.encode(
        texts,
        normalize_embeddings=True,
        show_progress_bar=True,
    )

    return embeddings, model

if __name__ == "__main__":

    if "--download" in sys.argv:
        download_encoder()
        print(f"Sentence encoder '{MODEL_NAME}' is available locally.")
        raise SystemExit(0)

    project_root = Path(__file__).resolve().parents[2]

    processed_file = (
        project_root
        / "backend"
        / "data"
        / "processed"
        / "transactions_clean.csv"
    )

    df = pd.read_csv(processed_file)

    X, model = build_semantic_features(df)

    print("\nSemantic embedding generation successful.")
    print(f"Transactions: {X.shape[0]}")
    print(f"Embedding dimensions: {X.shape[1]}")

    print("\nFirst transaction:")
    print(df.loc[0, "description_clean"])

    print("\nFirst 10 embedding values:")
    print(X[0][:10])