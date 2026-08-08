from __future__ import annotations

import os
from collections.abc import Generator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    """Base class for all FinanceIQ SQLAlchemy models."""


def get_database_url() -> str:
    """Return the PostgreSQL URL without providing an unsafe fallback."""

    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise RuntimeError(
            "DATABASE_URL is not configured. Copy .env.example to .env and "
            "export DATABASE_URL before using database-backed features."
        )
    if not database_url.startswith("postgresql+psycopg://"):
        raise RuntimeError(
            "DATABASE_URL must use PostgreSQL with the psycopg driver "
            "(postgresql+psycopg://)."
        )
    return database_url


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    """Create one process-wide SQLAlchemy engine when first needed."""

    return create_engine(
        get_database_url(),
        pool_pre_ping=True,
    )


@lru_cache(maxsize=1)
def get_session_factory() -> sessionmaker[Session]:
    """Create the configured SQLAlchemy session factory lazily."""

    return sessionmaker(
        bind=get_engine(),
        class_=Session,
        autoflush=False,
        expire_on_commit=False,
    )


def get_db() -> Generator[Session, None, None]:
    """Provide a transaction-safe FastAPI database session dependency."""

    session = get_session_factory()()
    try:
        yield session
    finally:
        session.close()
