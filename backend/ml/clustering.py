from pathlib import Path

import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

from backend.ml.features import build_text_features


def find_best_cluster_count(X, min_clusters=2, max_clusters=8):
    """
    Try several values of k and choose the one with
    the highest silhouette score.
    """

    scores = {}

    for k in range(min_clusters, max_clusters + 1):
        model = KMeans(
            n_clusters=k,
            random_state=42,
            n_init=20,
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

    best_k = max(scores, key=scores.get)

    return best_k, scores


def cluster_transactions(df, X, n_clusters):
    """
    Cluster transactions using KMeans.
    """

    model = KMeans(
        n_clusters=n_clusters,
        random_state=42,
        n_init=20,
    )

    labels = model.fit_predict(X)

    clustered_df = df.copy()
    clustered_df["cluster"] = labels

    return clustered_df, model


def inspect_clusters(df):
    """
    Print the transactions contained in each cluster.
    """

    for cluster_id in sorted(df["cluster"].unique()):

        print("\n" + "=" * 60)
        print(f"CLUSTER {cluster_id}")
        print("=" * 60)

        cluster_data = df[
            df["cluster"] == cluster_id
        ]

        counts = (
            cluster_data["description_clean"]
            .value_counts()
        )

        print(counts.to_string())

        print(
            f"\nTransactions in cluster: "
            f"{len(cluster_data)}"
        )


if __name__ == "__main__":

    project_root = Path(__file__).resolve().parents[2]

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
        / "transactions_clustered.csv"
    )

    df = pd.read_csv(input_file)

    # Convert transaction descriptions into TF-IDF features.
    X, vectorizer = build_text_features(df)

    print("Testing different numbers of clusters:\n")

    best_k, scores = find_best_cluster_count(
        X,
        min_clusters=2,
        max_clusters=8,
    )

    print(
        f"\nBest number of clusters: {best_k}"
    )

    # Train final KMeans model.
    clustered_df, model = cluster_transactions(
        df,
        X,
        n_clusters=best_k,
    )

    # Show what KMeans discovered.
    inspect_clusters(clustered_df)

    # Save results.
    clustered_df.to_csv(
        output_file,
        index=False,
    )

    print(
        "\nClustered transactions saved to:"
    )
    print(output_file)