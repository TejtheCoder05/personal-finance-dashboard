from pathlib import Path
import json

import joblib
import pandas as pd

from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
)

from backend.ml.embeddings import (
    build_semantic_features,
    MODEL_NAME,
)


# ---------------------------------------------------------
# Paths
# ---------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[2]

TRAIN_FILE = (
    PROJECT_ROOT
    / "backend"
    / "data"
    / "processed"
    / "transactions_clean.csv"
)

HOLDOUT_FILE = (
    PROJECT_ROOT
    / "backend"
    / "data"
    / "processed"
    / "transactions_holdout_clean.csv"
)

OUTPUT_FILE = (
    PROJECT_ROOT
    / "backend"
    / "data"
    / "processed"
    / "transactions_categorized.csv"
)

HOLDOUT_OUTPUT_FILE = (
    PROJECT_ROOT
    / "backend"
    / "data"
    / "processed"
    / "transactions_holdout_categorized.csv"
)

MODEL_DIR = (
    PROJECT_ROOT
    / "backend"
    / "models"
)

CLASSIFIER_FILE = (
    MODEL_DIR
    / "category_classifier.joblib"
)

METADATA_FILE = (
    MODEL_DIR
    / "category_classifier_metadata.json"
)


# ---------------------------------------------------------
# Prepare text
# ---------------------------------------------------------

def prepare_category_text(
    df: pd.DataFrame,
) -> pd.DataFrame:
    """
    Prepare transaction descriptions for semantic
    categorization.
    """

    work = df.copy()

    if "description_clean" not in work.columns:
        raise ValueError(
            "Dataset must contain "
            "'description_clean'."
        )

    work["description_clean"] = (
        work["description_clean"]
        .fillna("")
        .astype(str)
        .str.strip()
    )

    return work


# ---------------------------------------------------------
# Train semantic classifier
# ---------------------------------------------------------

def train_category_classifier(
    df: pd.DataFrame,
):
    """
    Train a supervised spending-category classifier
    using SentenceTransformer embeddings.
    """

    work = prepare_category_text(df)

    if "true_category" not in work.columns:
        raise ValueError(
            "Training data must contain "
            "'true_category'."
        )

    print(
        "\nGenerating semantic embeddings "
        "for training data..."
    )

    embeddings, encoder = (
        build_semantic_features(
            work,
            text_column="description_clean",
        )
    )

    labels = work["true_category"]

    classifier = LogisticRegression(
        max_iter=2000,
        class_weight="balanced",
        random_state=42,
    )

    classifier.fit(
        embeddings,
        labels,
    )

    return classifier, encoder


# ---------------------------------------------------------
# Predict categories
# ---------------------------------------------------------

def predict_categories(
    df: pd.DataFrame,
    classifier,
    encoder,
) -> pd.DataFrame:
    """
    Predict categories for transaction data using the
    trained semantic classifier.
    """

    work = prepare_category_text(df)

    texts = (
        work["description_clean"]
        .tolist()
    )

    embeddings = encoder.encode(
        texts,
        normalize_embeddings=True,
        show_progress_bar=True,
    )

    predictions = classifier.predict(
        embeddings
    )

    probabilities = (
        classifier.predict_proba(
            embeddings
        )
    )

    confidence = (
        probabilities.max(
            axis=1
        )
    )

    work["category"] = predictions

    work[
        "category_confidence"
    ] = confidence.round(4)

    return work


# ---------------------------------------------------------
# Evaluation
# ---------------------------------------------------------

def evaluate_categories(
    df: pd.DataFrame,
):
    """
    Evaluate predictions when true labels are available.
    """

    if (
        "true_category" not in df.columns
        or "category" not in df.columns
    ):
        print(
            "Evaluation skipped: labels unavailable."
        )

        return None

    true = df["true_category"]
    predicted = df["category"]

    accuracy = accuracy_score(
        true,
        predicted,
    )

    print("\nCategory Evaluation")
    print("=" * 60)

    print(
        f"Accuracy: "
        f"{accuracy:.2%}"
    )

    print(
        "\nClassification report:"
    )

    print(
        classification_report(
            true,
            predicted,
            zero_division=0,
        )
    )

    print(
        "\nConfusion matrix:"
    )

    labels = sorted(
        true.unique()
    )

    cm = confusion_matrix(
        true,
        predicted,
        labels=labels,
    )

    print(
        pd.DataFrame(
            cm,
            index=[
                f"True {label}"
                for label in labels
            ],
            columns=[
                f"Pred {label}"
                for label in labels
            ],
        )
    )

    return accuracy


# ---------------------------------------------------------
# Main
# ---------------------------------------------------------

def main():

    print("\nSemantic Category Classifier V2")
    print("=" * 60)

    # -----------------------------------------------------
    # Load training data
    # -----------------------------------------------------

    print("\nLoading training data:")
    print(TRAIN_FILE)

    train_df = pd.read_csv(
        TRAIN_FILE
    )

    print(
        f"Training transactions: "
        f"{len(train_df)}"
    )

    # -----------------------------------------------------
    # Train
    # -----------------------------------------------------

    classifier, encoder = (
        train_category_classifier(
            train_df
        )
    )

    print(
        "\nCategory classifier trained successfully."
    )

    # -----------------------------------------------------
    # Predict original data
    # -----------------------------------------------------

    categorized_train = (
        predict_categories(
            train_df,
            classifier,
            encoder,
        )
    )

    categorized_train.to_csv(
        OUTPUT_FILE,
        index=False,
    )

    print(
        "\nCategorized development data saved to:"
    )

    print(OUTPUT_FILE)

    # -----------------------------------------------------
    # Holdout evaluation
    # -----------------------------------------------------

    holdout_accuracy = None

    if HOLDOUT_FILE.exists():

        print(
            "\nLoading unseen holdout data:"
        )

        print(HOLDOUT_FILE)

        holdout_df = pd.read_csv(
            HOLDOUT_FILE
        )

        print(
            f"Holdout transactions: "
            f"{len(holdout_df)}"
        )

        categorized_holdout = (
            predict_categories(
                holdout_df,
                classifier,
                encoder,
            )
        )

        categorized_holdout.to_csv(
            HOLDOUT_OUTPUT_FILE,
            index=False,
        )

        print(
            "\nHoldout predictions saved to:"
        )

        print(
            HOLDOUT_OUTPUT_FILE
        )

        holdout_accuracy = (
            evaluate_categories(
                categorized_holdout
            )
        )

    # -----------------------------------------------------
    # Save classifier
    # -----------------------------------------------------

    MODEL_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    joblib.dump(
        classifier,
        CLASSIFIER_FILE,
    )

    metadata = {
        "model_type": (
            "SentenceTransformer embeddings "
            "+ LogisticRegression"
        ),
        "embedding_model": MODEL_NAME,
        "training_rows": len(train_df),
        "categories": list(
            classifier.classes_
        ),
        "holdout_accuracy": (
            round(
                float(holdout_accuracy),
                4,
            )
            if holdout_accuracy
            is not None
            else None
        ),
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

    print(
        "\nClassifier saved to:"
    )

    print(
        CLASSIFIER_FILE
    )

    print(
        "\nMetadata saved to:"
    )

    print(
        METADATA_FILE
    )


if __name__ == "__main__":
    main()