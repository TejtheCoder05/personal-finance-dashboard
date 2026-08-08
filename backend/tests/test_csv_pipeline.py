"""CSV validation, cleaning, and fingerprinting tests that need no database."""

from __future__ import annotations

import unittest

import pandas as pd

from backend.api import imports
from backend.api.imports import (
    ImportValidationError,
    inspect_transaction_csv,
    parse_transaction_csv,
)
from backend.db.finance_store import dataset_fingerprint
from backend.pipeline.clean import clean_transactions
from backend.pipeline.merchant import normalize_merchant


STANDARD_CSV = b"""Date,Description,Amount
2026-01-04,AMAZON MKTP US*2H4,54.20
2026-01-09,STARBUCKS STORE 1123,6.75
2026-01-15,WHOLE FOODS MKT 402,132.40
"""

DEBIT_CSV = b"""Posted Date,Payee,Debit
2026-01-04,SHELL OIL 55,41.10
2026-01-09,CHIPOTLE NEW BRUNSWICK NJ,14.60
"""


class CsvInspectionTests(unittest.TestCase):
    def test_suggests_canonical_columns(self) -> None:
        inspection = inspect_transaction_csv(STANDARD_CSV)
        self.assertEqual(inspection["row_count"], 3)
        self.assertEqual(
            inspection["suggested_mapping"],
            {"date": "Date", "description": "Description", "amount": "Amount"},
        )
        self.assertEqual(inspection["warnings"], [])
        self.assertEqual(len(inspection["preview"]), 3)

    def test_warns_when_a_field_cannot_be_identified(self) -> None:
        inspection = inspect_transaction_csv(b"When,What,How much\n2026-01-04,Coffee,5\n")
        self.assertIsNone(inspection["suggested_mapping"]["date"])
        self.assertEqual(len(inspection["warnings"]), 3)

    def test_rejects_unusable_uploads(self) -> None:
        cases = {
            "empty": b"",
            "header only": b"Date,Description,Amount\n",
            "not utf-8 csv": b"\xff\xfe\x00\x01binary",
            "duplicate columns": b"Date,date,Amount\n2026-01-04,x,5\n",
        }
        for label, content in cases.items():
            with self.subTest(case=label):
                with self.assertRaises(ImportValidationError):
                    inspect_transaction_csv(content)

    def test_enforces_the_upload_size_limit(self) -> None:
        oversized = b"Date,Description,Amount\n" + b"2026-01-04,Coffee,5.00\n" * 300_000
        self.assertGreater(len(oversized), imports.MAX_UPLOAD_BYTES)
        with self.assertRaises(ImportValidationError):
            inspect_transaction_csv(oversized)

    def test_enforces_the_transaction_row_limit(self) -> None:
        rows = imports.MAX_TRANSACTION_ROWS + 1
        content = b"Date,Description,Amount\n" + b"2026-01-04,Coffee,5.00\n" * rows
        self.assertLessEqual(len(content), imports.MAX_UPLOAD_BYTES)
        with self.assertRaises(ImportValidationError):
            inspect_transaction_csv(content)


class CsvParsingTests(unittest.TestCase):
    def test_purchase_sign_conventions(self) -> None:
        positive, _ = parse_transaction_csv(
            STANDARD_CSV, amount_sign="purchase_positive"
        )
        negative_csv = STANDARD_CSV.replace(b",54.20", b",-54.20")
        negative, _ = parse_transaction_csv(
            negative_csv, amount_sign="purchase_negative"
        )
        self.assertEqual(positive["Amount"].iloc[0], 54.20)
        self.assertEqual(negative["Amount"].iloc[0], 54.20)

    def test_amount_columns_require_an_explicit_convention(self) -> None:
        with self.assertRaises(ImportValidationError):
            parse_transaction_csv(STANDARD_CSV, amount_sign=None)

    def test_debit_columns_are_already_positive_purchases(self) -> None:
        canonical, mapping = parse_transaction_csv(DEBIT_CSV, amount_sign=None)
        self.assertEqual(mapping["amount"], "Debit")
        self.assertEqual(mapping["date"], "Posted Date")
        self.assertEqual(canonical["Amount"].tolist(), [41.10, 14.60])

        with self.assertRaises(ImportValidationError):
            parse_transaction_csv(DEBIT_CSV, amount_sign="purchase_negative")

    def test_currency_formatting_is_stripped(self) -> None:
        formatted = b'Date,Description,Amount\n2026-01-04,COSTCO,"$1,204.55"\n'
        canonical, _ = parse_transaction_csv(
            formatted, amount_sign="purchase_positive"
        )
        self.assertEqual(canonical["Amount"].iloc[0], 1204.55)

    def test_explicit_mapping_must_be_complete_and_present(self) -> None:
        with self.assertRaises(ImportValidationError):
            parse_transaction_csv(
                STANDARD_CSV,
                amount_sign="purchase_positive",
                date_column="Date",
                description_column="Description",
            )
        with self.assertRaises(ImportValidationError):
            parse_transaction_csv(
                STANDARD_CSV,
                amount_sign="purchase_positive",
                date_column="Missing",
                description_column="Description",
                amount_column="Amount",
            )

    def test_rows_with_missing_required_values_are_rejected(self) -> None:
        with self.assertRaises(ImportValidationError):
            parse_transaction_csv(
                b"Date,Description,Amount\n2026-01-04,Coffee,\n",
                amount_sign="purchase_positive",
            )


class CleaningTests(unittest.TestCase):
    def canonical(self, rows: list[tuple[str, str, float]]) -> pd.DataFrame:
        return pd.DataFrame(rows, columns=["Date", "Description", "Amount"])

    def test_normalizes_merchants_and_drops_duplicates(self) -> None:
        cleaned = clean_transactions(
            self.canonical(
                [
                    ("2026-01-04", "AMZN MKTP US", 54.20),
                    ("2026-01-04", "AMZN MKTP US", 54.20),
                    ("2026-01-09", "STARBUCKS STORE 1123", 6.75),
                ]
            )
        )
        self.assertEqual(len(cleaned), 2)
        self.assertEqual(cleaned["merchant"].tolist(), ["amazon", "starbucks"])

    def test_drops_rows_without_a_usable_description(self) -> None:
        cleaned = clean_transactions(
            self.canonical(
                [
                    ("2026-01-04", "1234567", 20.00),
                    ("2026-01-09", "TARGET STORE 220", 88.15),
                ]
            )
        )
        self.assertEqual(cleaned["merchant"].tolist(), ["target"])

    def test_merchant_aliases_and_noise_words(self) -> None:
        self.assertEqual(normalize_merchant("amzn mktp us"), "amazon")
        self.assertEqual(normalize_merchant("whole foods market"), "whole foods")
        self.assertEqual(normalize_merchant("bp gas station"), "bp")
        self.assertEqual(normalize_merchant(""), "")

    def test_aliases_only_match_a_fully_reduced_merchant(self) -> None:
        # Known limitation: aliases are applied to the whole reduced string, so
        # a leftover token from a store code keeps the raw bank abbreviation.
        self.assertEqual(normalize_merchant("amzn mktp us h"), "amzn h")


class FingerprintTests(unittest.TestCase):
    mapping = {"date": "Date", "description": "Description", "amount": "Amount"}

    def test_identical_uploads_share_a_fingerprint(self) -> None:
        self.assertEqual(
            dataset_fingerprint(STANDARD_CSV, self.mapping, "purchase_positive"),
            dataset_fingerprint(STANDARD_CSV, dict(self.mapping), "purchase_positive"),
        )

    def test_content_mapping_and_sign_all_change_the_fingerprint(self) -> None:
        baseline = dataset_fingerprint(STANDARD_CSV, self.mapping, "purchase_positive")
        variants = (
            dataset_fingerprint(DEBIT_CSV, self.mapping, "purchase_positive"),
            dataset_fingerprint(
                STANDARD_CSV, {**self.mapping, "amount": "Debit"}, "purchase_positive"
            ),
            dataset_fingerprint(STANDARD_CSV, self.mapping, "purchase_negative"),
        )
        for variant in variants:
            self.assertNotEqual(baseline, variant)


class TemporaryStoreTests(unittest.TestCase):
    def test_the_demo_store_evicts_the_oldest_datasets(self) -> None:
        imports._datasets.clear()
        self.addCleanup(imports._datasets.clear)

        overflow = imports.MAX_TEMPORARY_DATASETS + 5
        for index in range(overflow):
            imports.remember_dataset(
                imports.ImportedDataset(
                    dataset_id=f"dataset-{index}",
                    filename="demo.csv",
                    transactions=pd.DataFrame(),
                    analytics={},
                )
            )

        self.assertEqual(len(imports._datasets), imports.MAX_TEMPORARY_DATASETS)
        self.assertIsNone(imports.get_imported_dataset("dataset-0"))
        self.assertIsNotNone(imports.get_imported_dataset(f"dataset-{overflow - 1}"))
        self.assertTrue(imports.delete_imported_dataset(f"dataset-{overflow - 1}"))
        self.assertFalse(imports.delete_imported_dataset("dataset-0"))


if __name__ == "__main__":
    unittest.main()
