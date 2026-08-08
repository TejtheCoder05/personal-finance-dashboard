from __future__ import annotations

import os
import unittest
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import delete


os.environ.setdefault(
    "JWT_SECRET_KEY",
    "test-only-secret-0123456789abcdef0123456789abcdef",
)
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "30")

from backend.api.main import app  # noqa: E402
from backend.db.database import get_session_factory  # noqa: E402
from backend.db.models import User  # noqa: E402


@unittest.skipUnless(os.getenv("DATABASE_URL"), "DATABASE_URL is required")
class SavingsGoalTests(unittest.TestCase):
    password = "StrongGoalPassword123"

    def setUp(self) -> None:
        self.emails: set[str] = set()
        self.user_a = self.authenticated_client()
        self.user_b = self.authenticated_client()

    def tearDown(self) -> None:
        with get_session_factory()() as db:
            db.execute(delete(User).where(User.email.in_(self.emails)))
            db.commit()

    def authenticated_client(self) -> TestClient:
        client = TestClient(app)
        email = f"financeiq-goals-{uuid4().hex}@example.com"
        self.emails.add(email)
        registration = client.post(
            "/api/auth/register",
            json={"email": email, "password": self.password},
        )
        self.assertEqual(registration.status_code, 201)
        login = client.post(
            "/api/auth/login",
            data={"username": email, "password": self.password},
        )
        self.assertEqual(login.status_code, 200)
        return client

    def create_goal(self, client: TestClient, **overrides):
        payload = {
            "name": "Emergency Fund",
            "target_amount": "5000.00",
            "current_amount": "1250.00",
            "target_date": "2027-06-30",
            **overrides,
        }
        return client.post("/api/goals", json=payload)

    def test_goal_crud_and_calculated_progress(self) -> None:
        created = self.create_goal(self.user_a)
        self.assertEqual(created.status_code, 201)
        goal = created.json()
        self.assertEqual(goal["percent_complete"], "25.00")
        self.assertEqual(goal["remaining_amount"], "3750.00")

        listed = self.user_a.get("/api/goals")
        self.assertEqual(len(listed.json()), 1)

        updated = self.user_a.patch(
            f"/api/goals/{goal['id']}",
            json={"current_amount": "5000.00", "target_date": None},
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["percent_complete"], "100.00")
        self.assertEqual(updated.json()["remaining_amount"], "0.00")
        self.assertIsNone(updated.json()["target_date"])

        deleted = self.user_a.delete(f"/api/goals/{goal['id']}")
        self.assertEqual(deleted.status_code, 204)
        self.assertEqual(self.user_a.get("/api/goals").json(), [])

    def test_goal_validation(self) -> None:
        invalid_payloads = (
            {"name": " ", "target_amount": "100.00", "current_amount": "0"},
            {"name": "Goal", "target_amount": "0", "current_amount": "0"},
            {"name": "Goal", "target_amount": "100", "current_amount": "-1"},
            {"name": "Goal", "target_amount": "10.123", "current_amount": "0"},
        )
        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                self.assertEqual(
                    self.user_a.post("/api/goals", json=payload).status_code,
                    422,
                )

    def test_cross_user_goal_isolation(self) -> None:
        goal_id = self.create_goal(self.user_b).json()["id"]

        self.assertEqual(self.user_a.get("/api/goals").json(), [])
        self.assertEqual(
            self.user_a.patch(
                f"/api/goals/{goal_id}", json={"name": "Stolen"}
            ).status_code,
            404,
        )
        self.assertEqual(self.user_a.delete(f"/api/goals/{goal_id}").status_code, 404)
        self.assertEqual(len(self.user_b.get("/api/goals").json()), 1)

    def test_goals_require_authentication(self) -> None:
        anonymous = TestClient(app)
        self.assertEqual(anonymous.get("/api/goals").status_code, 401)
        self.assertEqual(
            anonymous.post(
                "/api/goals",
                json={"name": "Goal", "target_amount": "100", "current_amount": "0"},
            ).status_code,
            401,
        )

    def test_goal_persists_across_sessions(self) -> None:
        goal = self.create_goal(self.user_a).json()
        token = self.user_a.cookies.get("financeiq_access_token")
        restored_client = TestClient(app)
        restored_client.cookies.set("financeiq_access_token", token)

        response = restored_client.get("/api/goals")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()[0]["id"], goal["id"])


if __name__ == "__main__":
    unittest.main()
