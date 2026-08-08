from pathlib import Path

import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

from backend.ml.embeddings import build_semantic_features


def find_best_cluster_count(X, min_clusters=2, max_clusters=6):
    """
    Test several cluster counts using semantic embeddings.
    """

    scores = {}

    for k in range(min_clusters, max_clusters + 1):

        model = KMeans(
            n_clusters=k,
            random_state=42,
            n_init=50,
        )

        labels = model.fit_predict(X)

        score = silhouette_score(
            X,
            labels,
            metric="cosine",
        )

        scores[k] = score

        print(
            f"k={k}: silhouette score = {score:.4f}"
        )

    best_k = max(
        scores,
        key=scores.get,
    )

    return best_k, scores


def inspect_clusters(merchant_df):
    """
    Display merchants assigned to each cluster.
    """

    for cluster_id in sorted(
        merchant_df["cluster"].unique()
    ):

        print("\n" + "=" * 60)
        print(f"CLUSTER {cluster_id}")
        print("=" * 60)

        merchants = merchant_df[
            merchant_df["cluster"] == cluster_id
        ]["merchant"]

        for merchant in merchants:
            print(merchant)

        print(
            f"\nUnique merchants in cluster: "
            f"{len(merchants)}"
        )


if __name__ == "__main__":

    project_root = (
        Path(__file__)
        .resolve()
        .parents[2]
    )

    input_file = (
        project_root
        / "backend"
        / "data"
        / "processed"
        / "transactions_clean.csv"
    )

    output_file = (
        project_root
        / "backend"
        / "data"
        / "processed"
        / "transactions_semantic_clustered.csv"
    )

    df = pd.read_csv(input_file)

    # Work with unique normalized merchants.
    merchant_df = (
        df[["merchant"]]
        .drop_duplicates()
        .reset_index(drop=True)
    )

    print(
        f"Transactions: {len(df)}"
    )

    print(
        f"Unique merchants: "
        f"{len(merchant_df)}"
    )

    # Generate embeddings from normalized merchant names.
    X, embedding_model = (
        build_semantic_features(
            merchant_df,
            text_column="merchant",
        )
    )

    print(
        "\nTesting semantic cluster counts:\n"
    )

    best_k, scores = (
        find_best_cluster_count(
            X,
            min_clusters=2,
            max_clusters=6,
        )
    )

    print(
        f"\nBest semantic cluster count: {best_k}"
    )

    # Train final KMeans model.
    model = KMeans(
        n_clusters=best_k,
        random_state=42,
        n_init=50,
    )

    merchant_df["cluster"] = (
        model.fit_predict(X)
    )

    inspect_clusters(
        merchant_df
    )

    # Add cluster back to every transaction.
    df = df.merge(
        merchant_df,
        on="merchant",
        how="left",
    )

    df.to_csv(
        output_file,
        index=False,
    )

    print(
        "\nSemantic clustered transactions saved to:"
    )

    print(output_file)