from contextlib import asynccontextmanager
from datetime import date, datetime, timezone
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlmodel import Session, select

from .dates import adjust_for_sunday, compute_final_date, pretty_date
from . import stt
from .db import create_db_and_tables, get_session
from .extractor import extract
from .matching import find_candidates
from .models import Patient, Reminder, ReminderStatus, VisitType
from .safety import is_extraction_safe, is_message_safe, visit_type_is_valid
from .templates import render_message

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    stt.warm_up()
    yield


app = FastAPI(title="FollowUp API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "stt": stt.available()}


MAX_AUDIO_BYTES = 5_000_000  # ~1 min of compressed speech; a note is ~5 s


@app.post("/transcribe")
async def transcribe_audio(audio: UploadFile = File(...), session: Session = Depends(get_session)):
    """Doctor's recorded voice note -> text. The text is only ever fed to /notes/parse."""
    if not stt.available():
        raise HTTPException(status_code=503, detail="speech-to-text is not installed on the server")
    data = await audio.read()
    if not data:
        raise HTTPException(status_code=400, detail="empty audio")
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="audio too long")
    names = session.exec(select(Patient.name)).all()
    hint = "Clinic follow-up note. Patients: " + ", ".join(names) + ". Review after 2 weeks. 15 din baad bulao."
    try:
        text = await run_in_threadpool(stt.transcribe, data, hint)
    except Exception:
        raise HTTPException(status_code=422, detail="could not read that audio, try again")
    return {"text": text}


# --------------------------------------------------------------------------
# Shared request/response shapes
# --------------------------------------------------------------------------


class PatientOut(BaseModel):
    id: int
    name: str
    phone: str
    age: int
    last_visit_date: Optional[str] = None


def _patient_out(patient: Patient) -> PatientOut:
    return PatientOut(
        id=patient.id,
        name=patient.name,
        phone=patient.phone,
        age=patient.age,
        last_visit_date=patient.last_visit_date.isoformat() if patient.last_visit_date else None,
    )


class ReminderOut(BaseModel):
    id: int
    patient_id: int
    patient_name: str
    patient_phone: str
    follow_up_date: str
    visit_type: str
    message: str
    status: str
    created_at: datetime
    approved_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    doctor_seconds: Optional[float] = None


def _reminder_out(reminder: Reminder, patient: Patient) -> ReminderOut:
    return ReminderOut(
        id=reminder.id,
        patient_id=reminder.patient_id,
        patient_name=patient.name,
        patient_phone=patient.phone,
        follow_up_date=reminder.follow_up_date.isoformat(),
        visit_type=reminder.visit_type.value,
        message=reminder.message,
        status=reminder.status.value,
        created_at=reminder.created_at,
        approved_at=reminder.approved_at,
        sent_at=reminder.sent_at,
        doctor_seconds=reminder.doctor_seconds,
    )


# --------------------------------------------------------------------------
# POST /notes/parse
# --------------------------------------------------------------------------


class NoteIn(BaseModel):
    text: str


class ParseResponse(BaseModel):
    candidates: List[PatientOut]
    follow_up_date: Optional[str] = None
    visit_type: str
    message_preview: Optional[str] = None
    warnings: List[str]
    no_follow_up: bool


@app.post("/notes/parse", response_model=ParseResponse)
def parse_note(note: NoteIn, session: Session = Depends(get_session)):
    today = date.today()
    result = extract(note.text, today)
    warnings: List[str] = []

    # Layer 3 safety check on the raw extracted fields themselves, before
    # they ever touch a patient match or a message.
    safe, hits = is_extraction_safe(result.patient_name, result.visit_type)
    patient_name = result.patient_name
    if not safe:
        warnings.append(f"blocked terms removed from extracted name: {', '.join(hits)}")
        patient_name = ""

    if result.no_follow_up:
        return ParseResponse(
            candidates=[],
            follow_up_date=None,
            visit_type=result.visit_type,
            message_preview=None,
            warnings=warnings,
            no_follow_up=True,
        )

    all_patients = session.exec(select(Patient)).all()
    candidates = find_candidates(patient_name, all_patients) if patient_name else []

    if not candidates:
        warnings.append(
            "no matching patient found" if patient_name else "no patient name detected in note"
        )
    elif len(candidates) > 1:
        warnings.append("multiple matching patients found - choose one")

    final_date = compute_final_date(today, result.follow_up_in_days, result.follow_up_date)
    follow_up_date_str = final_date.isoformat() if final_date else None
    if not final_date:
        warnings.append("no follow-up date detected - choose a duration")

    message_preview = None
    if len(candidates) == 1 and final_date:
        chosen = candidates[0]
        message_preview = render_message(
            first_name=chosen.name.split()[0],
            date_pretty=pretty_date(final_date),
            visit_type=result.visit_type,
        )
        msg_safe, msg_hits = is_message_safe(message_preview)
        if not msg_safe:
            warnings.append(f"message blocked: {', '.join(msg_hits)}")
            message_preview = None

    return ParseResponse(
        candidates=[_patient_out(p) for p in candidates],
        follow_up_date=follow_up_date_str,
        visit_type=result.visit_type,
        message_preview=message_preview,
        warnings=warnings,
        no_follow_up=result.no_follow_up,
    )


# --------------------------------------------------------------------------
# POST /reminders
# --------------------------------------------------------------------------


class ReminderIn(BaseModel):
    patient_id: int
    follow_up_date: str
    visit_type: str
    doctor_seconds: Optional[float] = None


@app.post("/reminders", response_model=ReminderOut, status_code=201)
def create_reminder(payload: ReminderIn, session: Session = Depends(get_session)):
    patient = session.get(Patient, payload.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="patient not found")

    if not visit_type_is_valid(payload.visit_type):
        raise HTTPException(status_code=400, detail="invalid visit_type")

    # `patient` was loaded by primary key above, so it is guaranteed to be a
    # real DB patient - this satisfies the "patient_name must match a
    # patient in the DB" safety rule by construction.

    try:
        parsed_date = date.fromisoformat(payload.follow_up_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid follow_up_date, expected YYYY-MM-DD")

    final_date = adjust_for_sunday(parsed_date)

    message = render_message(
        first_name=patient.name.split()[0],
        date_pretty=pretty_date(final_date),
        visit_type=payload.visit_type,
    )
    safe, hits = is_message_safe(message)
    if not safe:
        raise HTTPException(status_code=400, detail=f"message failed safety check: {hits}")

    now = datetime.now(timezone.utc)
    reminder = Reminder(
        patient_id=patient.id,
        follow_up_date=final_date,
        visit_type=VisitType(payload.visit_type),
        message=message,
        status=ReminderStatus.approved,
        created_at=now,
        approved_at=now,
        doctor_seconds=payload.doctor_seconds,
    )
    session.add(reminder)
    session.commit()
    session.refresh(reminder)

    return _reminder_out(reminder, patient)


# --------------------------------------------------------------------------
# GET /reminders?status=
# --------------------------------------------------------------------------


@app.get("/reminders", response_model=List[ReminderOut])
def list_reminders(status: Optional[str] = None, session: Session = Depends(get_session)):
    query = select(Reminder)
    if status:
        valid_statuses = {s.value for s in ReminderStatus}
        if status not in valid_statuses:
            raise HTTPException(
                status_code=400, detail=f"status must be one of {sorted(valid_statuses)}"
            )
        query = query.where(Reminder.status == ReminderStatus(status))

    reminders = session.exec(query.order_by(Reminder.follow_up_date)).all()

    out = []
    for reminder in reminders:
        patient = session.get(Patient, reminder.patient_id)
        out.append(_reminder_out(reminder, patient))
    return out


# --------------------------------------------------------------------------
# PATCH /reminders/{id}
# --------------------------------------------------------------------------


class ReminderStatusIn(BaseModel):
    status: str


@app.patch("/reminders/{reminder_id}", response_model=ReminderOut)
def update_reminder_status(
    reminder_id: int,
    payload: ReminderStatusIn,
    session: Session = Depends(get_session),
):
    reminder = session.get(Reminder, reminder_id)
    if not reminder:
        raise HTTPException(status_code=404, detail="reminder not found")

    valid_statuses = {s.value for s in ReminderStatus}
    if payload.status not in valid_statuses:
        raise HTTPException(
            status_code=400, detail=f"status must be one of {sorted(valid_statuses)}"
        )

    reminder.status = ReminderStatus(payload.status)
    if reminder.status == ReminderStatus.sent and reminder.sent_at is None:
        reminder.sent_at = datetime.now(timezone.utc)

    session.add(reminder)
    session.commit()
    session.refresh(reminder)

    patient = session.get(Patient, reminder.patient_id)
    return _reminder_out(reminder, patient)


@app.delete("/reminders/{reminder_id}", status_code=204)
def delete_reminder(reminder_id: int, session: Session = Depends(get_session)):
    """Undo an approve. Only allowed before the reminder is sent."""
    reminder = session.get(Reminder, reminder_id)
    if not reminder:
        raise HTTPException(status_code=404, detail="reminder not found")
    if reminder.status != ReminderStatus.approved:
        raise HTTPException(status_code=409, detail="reminder already sent, cannot undo")
    session.delete(reminder)
    session.commit()


# --------------------------------------------------------------------------
# GET /patients?search=
# --------------------------------------------------------------------------


@app.get("/patients", response_model=List[PatientOut])
def search_patients(search: Optional[str] = None, session: Session = Depends(get_session)):
    all_patients = session.exec(select(Patient)).all()
    if search:
        matched = find_candidates(search, all_patients)
        return [_patient_out(p) for p in matched]
    return [_patient_out(p) for p in all_patients]


# --------------------------------------------------------------------------
# GET /stats
# --------------------------------------------------------------------------


@app.get("/stats")
def get_stats(session: Session = Depends(get_session)):
    reminders = session.exec(select(Reminder)).all()

    by_status = {s.value: 0 for s in ReminderStatus}
    for reminder in reminders:
        by_status[reminder.status.value] += 1

    doctor_seconds_values = [r.doctor_seconds for r in reminders if r.doctor_seconds is not None]
    avg_doctor_seconds = (
        round(sum(doctor_seconds_values) / len(doctor_seconds_values), 1)
        if doctor_seconds_values
        else None
    )

    return {
        "total_reminders": len(reminders),
        "approved": by_status["approved"],
        "sent": by_status["sent"],
        "confirmed": by_status["confirmed"],
        "visited": by_status["visited"],
        "missed": by_status["missed"],
        "avg_doctor_seconds": avg_doctor_seconds,
    }
