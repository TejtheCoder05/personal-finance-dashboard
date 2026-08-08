from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.auth.dependencies import CurrentUser
from backend.db.database import get_db
from backend.db.models import SavingsGoal


router = APIRouter(prefix="/api/goals", tags=["savings goals"])
Money = Annotated[Decimal, Field(max_digits=14, decimal_places=2)]


class GoalCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    target_amount: Money = Field(gt=0)
    current_amount: Money = Field(default=Decimal("0.00"), ge=0)
    target_date: date | None = None

    @field_validator("name")
    @classmethod
    def normalize_name(cls, name: str) -> str:
        normalized = name.strip()
        if not normalized:
            raise ValueError("Goal name cannot be empty.")
        return normalized


class GoalUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    target_amount: Money | None = Field(default=None, gt=0)
    current_amount: Money | None = Field(default=None, ge=0)
    target_date: date | None = None

    @field_validator("name")
    @classmethod
    def normalize_name(cls, name: str | None) -> str | None:
        if name is None:
            return None
        normalized = name.strip()
        if not normalized:
            raise ValueError("Goal name cannot be empty.")
        return normalized


class GoalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    target_amount: Decimal
    current_amount: Decimal
    target_date: date | None
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def percent_complete(self) -> Decimal:
        percentage = self.current_amount / self.target_amount * Decimal("100")
        return min(percentage, Decimal("100")).quantize(Decimal("0.01"))

    @computed_field
    @property
    def remaining_amount(self) -> Decimal:
        return max(
            self.target_amount - self.current_amount,
            Decimal("0"),
        ).quantize(Decimal("0.01"))


def owned_goal_or_404(db: Session, user_id: UUID, goal_id: UUID) -> SavingsGoal:
    goal = db.scalar(
        select(SavingsGoal).where(
            SavingsGoal.id == goal_id,
            SavingsGoal.user_id == user_id,
        )
    )
    if goal is None:
        raise HTTPException(status_code=404, detail="Savings goal not found.")
    return goal


@router.get("", response_model=list[GoalResponse])
def list_goals(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> list[SavingsGoal]:
    return list(
        db.scalars(
            select(SavingsGoal)
            .where(SavingsGoal.user_id == current_user.id)
            .order_by(SavingsGoal.created_at.desc())
        )
    )


@router.post("", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
def create_goal(
    payload: GoalCreate,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> SavingsGoal:
    goal = SavingsGoal(user_id=current_user.id, **payload.model_dump())
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


@router.patch("/{goal_id}", response_model=GoalResponse)
def update_goal(
    goal_id: UUID,
    payload: GoalUpdate,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> SavingsGoal:
    goal = owned_goal_or_404(db, current_user.id, goal_id)
    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        if value is not None or field == "target_date":
            setattr(goal, field, value)
    db.commit()
    db.refresh(goal)
    return goal


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(
    goal_id: UUID,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    goal = owned_goal_or_404(db, current_user.id, goal_id)
    db.delete(goal)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
