from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.auth.dependencies import CurrentUser
from backend.auth.schemas import TokenResponse, UserCreate, UserResponse
from backend.auth.security import (
    DUMMY_PASSWORD_HASH,
    create_access_token,
    get_access_token_expire_minutes,
    hash_password,
    verify_password,
)
from backend.db.database import get_db
from backend.db.models import User


router = APIRouter(prefix="/api/auth", tags=["authentication"])
email_adapter = TypeAdapter(EmailStr)


def normalize_email(email: str) -> str:
    return str(email_adapter.validate_python(email.strip())).lower()


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_user(
    payload: UserCreate,
    db: Annotated[Session, Depends(get_db)],
) -> User:
    email = normalize_email(str(payload.email))
    existing_user = db.scalar(select(User).where(User.email == email))
    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(
        email=email,
        hashed_password=hash_password(payload.password.get_secret_value()),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        ) from exc
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login_user(
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    try:
        email = normalize_email(form.username)
    except ValidationError:
        email = None

    user = db.scalar(select(User).where(User.email == email)) if email else None
    password_matches = verify_password(
        form.password,
        user.hashed_password if user is not None else DUMMY_PASSWORD_HASH,
    )
    if user is None or not password_matches:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    expires_in = get_access_token_expire_minutes() * 60
    return TokenResponse(
        access_token=create_access_token(user.id),
        expires_in=expires_in,
    )


@router.get("/me", response_model=UserResponse)
def get_authenticated_user(current_user: CurrentUser) -> User:
    return current_user
