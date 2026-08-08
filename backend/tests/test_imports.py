from __future__ import annotations

import os
import unittest
from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlalchemy import delete, select


os.environ.setdefault(
    "JWT_SECRET_KEY",
    "test-only-secret-0123456789abcdef0123456789abcdef",
)
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "30")

from backend.api.main import app  # noqa: E402
from backend.db.database import get_session_factory  # noqa: E402
from backend.db.models import (  # noqa: E402
    FinanceTransaction,
    TransactionDataset,
    User,
)


USER_A_CSV = b"""Date,Description,Amount
2026-01-04,AMAZON MARKETPLACE,54.20
2026-01-09,STARBUCKS STORE 1123,6.75
2026-01-15,WHOLE FOODS MKT 402,132.40
2026-01-22,BP GAS STATION,48.10
2026-02-02,NETFLIX.COM,15.99
2026-02-06,STARBUCKS STORE 1123,7.25
2026-02-11,AMAZON MARKETPLACE,61.30
2026-02-18,WHOLE FOODS MKT 402,118.65
2026-02-24,BP GAS STATION,52.80
2026-02-27,AMAZON MARKETPLACE,1450.00
"""

USER_B_CSV = b"""Date,Description,Amount
2026-03-03,TARGET STORE 220,88.15
2026-03-08,CHIPOTLE MEXICAN GRILL,14.60
2026-03-14,SHELL OIL,41.05
2026-03-19,TARGET STORE 220,92.70
2026-03-25,CHIPOTLE MEXICAN GRILL,16.20
"""

MALFORMED_CSV = b"""Reference,Notes
A-1,groceries
A-2,fuel
"""


@unittest.skipUnless(os.getenv("DATABASE_URL"), "DATABASE_URL is required")
class AuthenticatedImportTests(unittest.TestCase):
    """Persistent, user-scoped CSV imports and the analytics built from them."""

    password = "StrongImportPassword123"

    @classmethod
    def setUpClass(cls) -> None:
        cls.emails: set[str] = set()
        cls.user_a, cls.user_a_id = cls.authenticated_client()
        cls.user_b, cls.user_b_id = cls.authenticated_client()
        cls.anonymous = TestClient(app)
        cls.dataset_a = cls.import_csv(cls.user_a, USER_A_CSV, "user-a.csv").json()
        cls.dataset_b = cls.import_csv(cls.user_b, USER_B_CSV, "user-b.csv").json()

    @classmethod
    def tearDownClass(cls) -> None:
        with get_session_factory()() as db:
            db.execute(delete(User).where(User.email.in_(cls.emails)))
            db.commit()

    @classmethod
    def authenticated_client(cls) -> tuple[TestClient, UUID]:
        client = TestClient(app)
        email = f"financeiq-imports-{uuid4().hex}@example.com"
        cls.emails.add(email)
        registration = client.post(
            "/api/auth/register",
            json={"email": email, "password": cls.password},
        )
        assert registration.status_code == 201, registration.text
        login = client.post(
            "/api/auth/login",
            data={"username": email, "password": cls.password},
        )
        assert login.status_code == 200, login.text
        return client, UUID(registration.json()["id"])

    @classmethod
    def import_csv(cls, client: TestClient, content: bytes, filename: str):
        return client.post(
            "/api/imports",
            files={"file": (filename, content, "text/csv")},
            data={"amount_sign": "purchase_positive"},
        )

    def stored_transactions(self, user_id: UUID) -> list[FinanceTransaction]:
        with get_session_factory()() as db:
            return list(
                db.scalars(
                    select(FinanceTransaction).where(
                        FinanceTransaction.user_id == user_id
                    )
                )
            )

    # -----------------------------------------------------
    # Persistence
    # -----------------------------------------------------

    def test_authenticated_import_is_persisted_to_postgresql(self) -> None:
        self.assertEqual(self.dataset_a["storage"], "account")
        self.assertEqual(self.dataset_a["filename"], "user-a.csv")
        self.assertEqual(self.dataset_a["transaction_count"], 10)
        self.assertTrue(self.dataset_a["is_active"])
        self.assertEqual(
            self.dataset_a["column_mapping"],
            {"date": "Date", "description": "Description", "amount": "Amount"},
        )

        stored = self.stored_transactions(self.user_a_id)
        self.assertEqual(len(stored), 10)
        merchants = {transaction.merchant for transaction in stored}
        self.assertEqual(
            merchants,
            {"amazon marketplace", "starbucks", "whole foods mkt", "bp", "netflix"},
        )
        self.assertTrue(all(transaction.category for transaction in stored))

    def test_stored_transactions_belong_to_the_importing_user(self) -> None:
        with get_session_factory()() as db:
            dataset = db.get(TransactionDataset, UUID(self.dataset_a["dataset_id"]))
            self.assertEqual(dataset.user_id, self.user_a_id)
            owners = set(
                db.scalars(
                    select(FinanceTransaction.user_id).where(
                        FinanceTransaction.dataset_id == dataset.id
                    )
                )
            )
        self.assertEqual(owners, {self.user_a_id})

    def test_import_survives_a_new_session(self) -> None:
        token = self.user_a.cookies.get("financeiq_access_token")
        restored = TestClient(app)
        restored.cookies.set("financeiq_access_token", token)

        datasets = restored.get("/api/imports")
        self.assertEqual(datasets.status_code, 200)
        self.assertEqual(datasets.json()[0]["dataset_id"], self.dataset_a["dataset_id"])

        transactions = restored.get("/api/transactions")
        self.assertEqual(transactions.status_code, 200)
        self.assertEqual(len(transactions.json()), 10)

    # -----------------------------------------------------
    # Retrieval and account isolation
    # -----------------------------------------------------

    def test_user_retrieves_own_imported_transactions(self) -> None:
        response = self.user_a.get(
            "/api/transactions",
            params={"dataset_id": self.dataset_a["dataset_id"], "limit": 50},
        )
        self.assertEqual(response.status_code, 200)
        transactions = response.json()
        self.assertEqual(len(transactions), 10)
        self.assertEqual(
            {round(float(row["amount"]), 2) for row in transactions[:1]},
            {1450.00},
        )
        self.assertNotIn("Target", {row["merchant"] for row in transactions})

    def test_another_user_cannot_read_a_foreign_dataset(self) -> None:
        foreign_id = self.dataset_a["dataset_id"]
        for endpoint in (
            "/api/summary",
            "/api/monthly",
            "/api/categories",
            "/api/merchants",
            "/api/anomalies",
            "/api/transactions",
        ):
            with self.subTest(endpoint=endpoint):
                response = self.user_b.get(endpoint, params={"dataset_id": foreign_id})
                self.assertEqual(response.status_code, 404)

        self.assertEqual(
            self.anonymous.get(
                "/api/transactions", params={"dataset_id": foreign_id}
            ).status_code,
            404,
        )

    def test_a_foreign_dataset_cannot_be_deleted(self) -> None:
        response = self.user_b.delete(f"/api/imports/{self.dataset_a['dataset_id']}")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(len(self.stored_transactions(self.user_a_id)), 10)

    def test_import_listing_is_scoped_to_the_authenticated_user(self) -> None:
        listing_b = self.user_b.get("/api/imports").json()
        self.assertEqual(len(listing_b), 1)
        self.assertEqual(listing_b[0]["dataset_id"], self.dataset_b["dataset_id"])
        self.assertEqual(self.anonymous.get("/api/imports").status_code, 401)

    # -----------------------------------------------------
    # Analytics
    # -----------------------------------------------------

    def test_analytics_default_to_the_users_active_dataset(self) -> None:
        summary_a = self.user_a.get("/api/summary").json()
        summary_b = self.user_b.get("/api/summary").json()
        self.assertEqual(summary_a["transaction_count"], 10)
        self.assertEqual(summary_b["transaction_count"], 5)
        self.assertEqual(summary_a["total_spending"], 1947.44)

        merchants_a = {row["merchant"] for row in self.user_a.get("/api/merchants").json()}
        merchants_b = {row["merchant"] for row in self.user_b.get("/api/merchants").json()}
        self.assertFalse(merchants_a & merchants_b)

        months = [row["month"] for row in self.user_a.get("/api/monthly").json()]
        self.assertEqual(months, ["2026-01", "2026-02"])

        categories = self.user_a.get("/api/categories").json()
        self.assertTrue(categories)
        self.assertAlmostEqual(
            sum(row["total_spending"] for row in categories),
            summary_a["total_spending"],
            places=2,
        )

    def test_anomaly_analytics_come_from_stored_predictions(self) -> None:
        anomalies = self.user_a.get("/api/anomalies").json()
        self.assertTrue(
            all(row["amount"] > 0 for row in anomalies),
            "anomaly rows should carry their stored amounts",
        )
        with get_session_factory()() as db:
            flagged = db.scalars(
                select(FinanceTransaction.amount).where(
                    FinanceTransaction.user_id == self.user_a_id,
                    FinanceTransaction.is_anomaly.is_(True),
                )
            ).all()
        self.assertEqual(len(anomalies), len(flagged))

    # -----------------------------------------------------
    # Duplicate handling
    # -----------------------------------------------------

    def test_reimporting_an_identical_csv_does_not_duplicate_transactions(self) -> None:
        repeat = self.import_csv(self.user_a, USER_A_CSV, "user-a.csv")
        self.assertEqual(repeat.status_code, 200)
        self.assertEqual(repeat.json()["dataset_id"], self.dataset_a["dataset_id"])
        self.assertEqual(len(self.stored_transactions(self.user_a_id)), 10)
        self.assertEqual(len(self.user_a.get("/api/imports").json()), 1)

    def test_a_different_csv_creates_a_second_active_dataset(self) -> None:
        client, user_id = self.authenticated_client()
        first = self.import_csv(client, USER_A_CSV, "history-1.csv").json()
        second = self.import_csv(client, USER_B_CSV, "history-2.csv")
        self.assertEqual(second.status_code, 201)
        second_dataset = second.json()
        self.assertNotEqual(second_dataset["dataset_id"], first["dataset_id"])

        listing = client.get("/api/imports").json()
        self.assertEqual(len(listing), 2)
        active = [dataset for dataset in listing if dataset["is_active"]]
        self.assertEqual(len(active), 1)
        self.assertEqual(active[0]["dataset_id"], second_dataset["dataset_id"])

        # Both imports are retained, and analytics follow the active one.
        self.assertEqual(len(self.stored_transactions(user_id)), 15)
        self.assertEqual(client.get("/api/summary").json()["transaction_count"], 5)

        # An earlier import can be made active again without re-uploading.
        reactivated = self.import_csv(client, USER_A_CSV, "history-1.csv")
        self.assertEqual(reactivated.status_code, 200)
        self.assertEqual(client.get("/api/summary").json()["transaction_count"], 10)

        # Deleting the active import falls back to the remaining one, not the demo.
        self.assertEqual(
            client.delete(f"/api/imports/{first['dataset_id']}").status_code,
            204,
        )
        self.assertEqual(len(self.stored_transactions(user_id)), 5)
        self.assertEqual(client.get("/api/summary").json()["transaction_count"], 5)

    def test_deleting_an_import_clears_it_and_restores_demo_analytics(self) -> None:
        client, user_id = self.authenticated_client()
        dataset = self.import_csv(client, USER_B_CSV, "removable.csv").json()

        deleted = client.delete(f"/api/imports/{dataset['dataset_id']}")
        self.assertEqual(deleted.status_code, 204)
        self.assertEqual(self.stored_transactions(user_id), [])
        self.assertEqual(client.get("/api/imports").json(), [])

        demo_summary = self.anonymous.get("/api/summary").json()
        self.assertEqual(client.get("/api/summary").json(), demo_summary)

    # -----------------------------------------------------
    # Anonymous demo behaviour
    # -----------------------------------------------------

    def test_anonymous_import_stays_temporary(self) -> None:
        response = self.import_csv(self.anonymous, USER_B_CSV, "anonymous.csv")
        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(payload["storage"], "temporary")

        summary = self.anonymous.get(
            "/api/summary", params={"dataset_id": payload["dataset_id"]}
        )
        self.assertEqual(summary.status_code, 200)
        self.assertEqual(summary.json()["transaction_count"], 5)

        with get_session_factory()() as db:
            stored = db.scalars(
                select(TransactionDataset).where(
                    TransactionDataset.original_filename == "anonymous.csv"
                )
            ).all()
        self.assertEqual(stored, [])

        self.assertEqual(
            self.anonymous.delete(
                f"/api/imports/{payload['dataset_id']}"
            ).status_code,
            204,
        )

    def test_anonymous_dashboard_serves_the_demo_dataset(self) -> None:
        for endpoint in (
            "/api/summary",
            "/api/monthly",
            "/api/categories",
            "/api/merchants",
            "/api/anomalies",
            "/api/transactions",
        ):
            with self.subTest(endpoint=endpoint):
                self.assertEqual(self.anonymous.get(endpoint).status_code, 200)

    # -----------------------------------------------------
    # Validation
    # -----------------------------------------------------

    def test_malformed_csv_is_rejected_for_both_audiences(self) -> None:
        cases = {
            "missing columns": MALFORMED_CSV,
            "empty file": b"",
            "not a csv": b"\xff\xfe\x00binary",
        }
        for label, content in cases.items():
            for name, client in (
                ("authenticated", self.user_a),
                ("anonymous", self.anonymous),
            ):
                with self.subTest(case=label, client=name):
                    response = self.import_csv(client, content, "broken.csv")
                    self.assertEqual(response.status_code, 422)

        self.assertEqual(
            self.import_csv(self.user_a, USER_A_CSV, "notes.txt").status_code,
            415,
        )
        # A rejected upload must not leave partial data behind.
        self.assertEqual(len(self.stored_transactions(self.user_a_id)), 10)

    def test_validation_endpoint_suggests_a_mapping(self) -> None:
        response = self.user_a.post(
            "/api/imports/validate",
            files={"file": ("user-a.csv", USER_A_CSV, "text/csv")},
        )
        self.assertEqual(response.status_code, 200)
        inspection = response.json()
        self.assertEqual(inspection["row_count"], 10)
        self.assertEqual(
            inspection["suggested_mapping"],
            {"date": "Date", "description": "Description", "amount": "Amount"},
        )


if __name__ == "__main__":
    unittest.main()
