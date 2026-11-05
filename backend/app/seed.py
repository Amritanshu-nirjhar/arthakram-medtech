"""Seed the SQLite DB with fictional patients and reminders.

`python -m app.seed` resets (drops) and re-seeds the whole database.
30 fictional Indian-name patients (including two "Amit"s to demo the
tap-to-choose flow), fake 10-digit phones, and one patient carrying
DEMO_PHONE from the environment so a real phone can receive the live
demo message. 10 pre-existing reminders in mixed statuses.
"""

import os
import random
from datetime import date, datetime, timedelta, timezone

from dotenv import load_dotenv
from sqlmodel import Session

from .db import DB_PATH, create_db_and_tables, engine
from .dates import pretty_date
from .models import Patient, Reminder, ReminderStatus, VisitType
from .templates import render_message

load_dotenv()

random.seed(42)

# 30 fictional patients. All data is invented (BUILD_PLAN rule: fictional
# data only). Includes "Amit Kumar" and "Amit Patel" so the doctor flow
# can demo tap-to-choose on an ambiguous name.
PATIENT_NAMES = [
    "Ramesh Kumar",
    "Priya Sharma",
    "Anil Verma",
    "Sunita Devi",
    "Kavita Joshi",
    "Meena Gupta",
    "Rahul Singh",
    "Amit Kumar",
    "Amit Patel",
    "Neha Reddy",
    "Suresh Nair",
    "Pooja Iyer",
    "Vikram Rao",
    "Anjali Mehta",
    "Deepak Chauhan",
    "Ritu Malhotra",
    "Sanjay Yadav",
    "Geeta Pillai",
    "Arjun Kapoor",
    "Shalini Bose",
    "Manoj Tiwari",
    "Divya Nambiar",
    "Rajesh Khanna",
    "Swati Desai",
    "Karan Thakur",
    "Nisha Agarwal",
    "Vivek Saxena",
    "Lata Menon",
    "Ashok Chopra",
    "Preeti Bhatt",
]

# This patient gets the real DEMO_PHONE (from env) so the receptionist can
# send a live WhatsApp message to an actual phone during the demo. It also
# happens to be the patient used in test note 1 of BUILD_PLAN section 10.
DEMO_PATIENT_NAME = "Ramesh Kumar"


def _fallback_phone(index: int) -> str:
    """Deterministic fake 10-digit phone, e.g. 9000000001."""
    return f"9{index:09d}"


def _phone_for(index: int, name: str) -> str:
    if name == DEMO_PATIENT_NAME:
        demo_phone = os.getenv("DEMO_PHONE", "").strip()
        digits = "".join(ch for ch in demo_phone if ch.isdigit())
        if len(digits) >= 10:
            return digits[-10:]
    return _fallback_phone(index)


def _build_patients(today: date) -> list[Patient]:
    patients = []
    for i, name in enumerate(PATIENT_NAMES, start=1):
        age = 18 + (i * 7) % 65
        last_visit = today - timedelta(days=(i * 11) % 180 + 1)
        patients.append(
            Patient(
                name=name,
                phone=_phone_for(i, name),
                age=age,
                last_visit_date=last_visit,
            )
        )
    return patients


# 10 pre-existing reminders, spread across every status, so the
# receptionist queue and dashboard aren't empty (BUILD_PLAN section 10).
# (patient_name, days_offset_from_today, visit_type, status)
REMINDER_SEED = [
    ("Ramesh Kumar", 3, VisitType.follow_up, ReminderStatus.approved),
    ("Priya Sharma", 1, VisitType.report_review, ReminderStatus.approved),
    ("Anil Verma", -2, VisitType.follow_up, ReminderStatus.confirmed),
    ("Sunita Devi", 7, VisitType.follow_up, ReminderStatus.sent),
    ("Meena Gupta", -5, VisitType.report_review, ReminderStatus.visited),
    ("Rahul Singh", -10, VisitType.follow_up, ReminderStatus.missed),
    ("Neha Reddy", 14, VisitType.routine_check, ReminderStatus.approved),
    ("Amit Kumar", 2, VisitType.follow_up, ReminderStatus.sent),
    ("Amit Patel", 5, VisitType.report_review, ReminderStatus.confirmed),
    ("Vikram Rao", -1, VisitType.routine_check, ReminderStatus.visited),
]


def _reset_db_file() -> None:
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)


def seed() -> None:
    _reset_db_file()
    create_db_and_tables()

    today = date.today()
    with Session(engine) as session:
        patients = _build_patients(today)
        session.add_all(patients)
        session.commit()
        for p in patients:
            session.refresh(p)

        by_name = {p.name: p for p in patients}

        for name, offset, visit_type, status in REMINDER_SEED:
            patient = by_name[name]
            follow_up_date = today + timedelta(days=offset)
            message = render_message(
                first_name=patient.name.split()[0],
                date_pretty=pretty_date(follow_up_date),
                visit_type=visit_type.value,
            )
            created_at = datetime.now(timezone.utc) - timedelta(days=max(offset, 0) + 1)
            sent_at = None
            if status in (ReminderStatus.sent, ReminderStatus.confirmed, ReminderStatus.visited):
                sent_at = created_at + timedelta(hours=1)

            reminder = Reminder(
                patient_id=patient.id,
                follow_up_date=follow_up_date,
                visit_type=visit_type,
                message=message,
                status=status,
                created_at=created_at,
                approved_at=created_at,
                sent_at=sent_at,
                doctor_seconds=round(random.uniform(5.0, 14.0), 1),
            )
            session.add(reminder)

        session.commit()

    print(f"Seeded {len(patients)} patients and {len(REMINDER_SEED)} reminders.")
    print(f"Database: {DB_PATH}")


if __name__ == "__main__":
    seed()
