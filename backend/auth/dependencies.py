from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from backend.auth.security import AUTH_COOKIE_NAME, decode_access_token
from backend.db.database import get_optional_db
from backend.db.models import User


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def credentials_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_optional_user(
    request: Request,
    bearer_token: Annotated[str | None, Depends(oauth2_scheme)],
    db: Annotated[Session | None, Depends(get_optional_db)],
) -> User | None:
    """Identify the caller when signed in, without rejecting anonymous demo use."""

    token = bearer_token or request.cookies.get(AUTH_COOKIE_NAME)
    if not token or db is None:
        return None
    try:
        user_id = decode_access_token(token)
    except ValueError:
        return None
    return db.get(User, user_id)


def get_current_user(
    user: Annotated[User | None, Depends(get_optional_user)],
) -> User:
    if user is None:
        raise credentials_exception()
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[User | None, Depends(get_optional_user)]
