from __future__ import annotations

import os
import unittest
from datetime import timedelta
from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlalchemy import delete, select


os.environ.setdefault(
    "JWT_SECRET_KEY",
    "test-only-secret-0123456789abcdef0123456789abcdef",
)
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "30")

from backend.api.main import app  # noqa: E402
from backend.auth.security import create_access_token, decode_access_token  # noqa: E402
from backend.db.database import get_session_factory  # noqa: E402
from backend.db.models import User  # noqa: E402


@unittest.skipUnless(os.getenv("DATABASE_URL"), "DATABASE_URL is required")
class AuthenticationTests(unittest.TestCase):
    password = "StrongTestPassword123"

    def setUp(self) -> None:
        self.client = TestClient(app)
        self.created_emails: set[str] = set()

    def tearDown(self) -> None:
        if not self.created_emails:
            return
        with get_session_factory()() as db:
            db.execute(delete(User).where(User.email.in_(self.created_emails)))
            db.commit()

    def unique_email(self) -> str:
        email = f"financeiq-test-{uuid4().hex}@example.com"
        self.created_emails.add(email)
        return email

    def register(self, email: str | None = None):
        email = email or self.unique_email()
        return self.client.post(
            "/api/auth/register",
            json={"email": email, "password": self.password},
        )

    def login(self, email: str, password: str | None = None):
        return self.client.post(
            "/api/auth/login",
            data={"username": email, "password": password or self.password},
        )

    def test_registration_returns_safe_normalized_user(self) -> None:
        email = self.unique_email()
        response = self.register(email.upper())

        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(body["email"], email)
        self.assertNotIn("hashed_password", body)
        self.assertNotIn("password", body)

    def test_duplicate_registration_is_rejected(self) -> None:
        email = self.unique_email()
        self.assertEqual(self.register(email).status_code, 201)

        duplicate = self.register(email.upper())
        self.assertEqual(duplicate.status_code, 409)

    def test_password_is_stored_as_argon2_hash(self) -> None:
        email = self.unique_email()
        response = self.register(email)
        self.assertEqual(response.status_code, 201)

        with get_session_factory()() as db:
            user = db.scalar(select(User).where(User.email == email))
            self.assertIsNotNone(user)
            assert user is not None
            self.assertNotEqual(user.hashed_password, self.password)
            self.assertTrue(user.hashed_password.startswith("$argon2"))

    def test_successful_login_returns_bearer_token(self) -> None:
        email = self.unique_email()
        self.assertEqual(self.register(email).status_code, 201)

        response = self.login(email)
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["token_type"], "bearer")
        self.assertTrue(body["access_token"])
        self.assertEqual(body["expires_in"], 1800)
        self.assertIn("financeiq_access_token", response.cookies)

    def test_incorrect_password_uses_generic_error(self) -> None:
        email = self.unique_email()
        self.assertEqual(self.register(email).status_code, 201)

        response = self.login(email, "IncorrectPassword123")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], "Incorrect email or password.")

        missing = self.login(self.unique_email(), "IncorrectPassword123")
        self.assertEqual(missing.status_code, 401)
        self.assertEqual(missing.json()["detail"], "Incorrect email or password.")

    def test_valid_token_identifies_user(self) -> None:
        email = self.unique_email()
        user_id = self.register(email).json()["id"]
        token = self.login(email).json()["access_token"]

        self.assertEqual(str(decode_access_token(token)), user_id)

    def test_invalid_and_expired_tokens_are_rejected(self) -> None:
        invalid = self.client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer not-a-valid-token"},
        )
        self.assertEqual(invalid.status_code, 401)

        email = self.unique_email()
        user_id = self.register(email).json()["id"]
        expired_token = create_access_token(
            UUID(user_id),
            expires_delta=timedelta(seconds=-1),
        )
        expired = self.client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        self.assertEqual(expired.status_code, 401)

    def test_me_returns_authenticated_user(self) -> None:
        email = self.unique_email()
        self.assertEqual(self.register(email).status_code, 201)
        token = self.login(email).json()["access_token"]

        response = self.client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["email"], email)
        self.assertNotIn("hashed_password", response.json())

    def test_cookie_session_and_logout(self) -> None:
        email = self.unique_email()
        self.assertEqual(self.register(email).status_code, 201)
        self.assertEqual(self.login(email).status_code, 200)

        authenticated = self.client.get("/api/auth/me")
        self.assertEqual(authenticated.status_code, 200)
        self.assertEqual(authenticated.json()["email"], email)

        logout = self.client.post("/api/auth/logout")
        self.assertEqual(logout.status_code, 204)
        self.assertEqual(self.client.get("/api/auth/me").status_code, 401)

    def test_me_without_token_is_rejected(self) -> None:
        response = self.client.get("/api/auth/me")
        self.assertEqual(response.status_code, 401)


if __name__ == "__main__":
    unittest.main()
