"""Patient and Reminder tables (BUILD_PLAN section 5)."""

from datetime import date, datetime, timezone
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


class VisitType(str, Enum):
    """Only these 3 values are ever allowed (BUILD_PLAN section 5)."""

    follow_up = "follow_up"
    report_review = "report_review"
    routine_check = "routine_check"


VISIT_TYPE_LABELS = {
    VisitType.follow_up: "follow-up visit",
    VisitType.report_review: "report review",
    VisitType.routine_check: "routine check-up",
}


class ReminderStatus(str, Enum):
    approved = "approved"
    sent = "sent"
    confirmed = "confirmed"
    visited = "visited"
    missed = "missed"


class Patient(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    phone: str
    age: int
    last_visit_date: Optional[date] = None


class Reminder(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    patient_id: int = Field(foreign_key="patient.id", index=True)
    follow_up_date: date
    visit_type: VisitType
    message: str
    status: ReminderStatus = Field(default=ReminderStatus.approved, index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    approved_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    doctor_seconds: Optional[float] = None
