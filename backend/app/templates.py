"""Fixed, pre-approved patient message templates (BUILD_PLAN section 7).

The doctor's raw note text is NEVER used here. A message can only ever
contain: the patient's first name, the (already Sunday-adjusted) date, the
visit-type label, the clinic name, the doctor name and the clinic phone
number.
"""

import os
from typing import Optional

MESSAGE_TEMPLATE = (
    "Hi {first_name}, this is a reminder from {clinic_name}. "
    "{doctor_name} would like to see you on {date_pretty} for your "
    "{visit_label}. Reply YES to confirm, or call {clinic_phone} to "
    "reschedule."
)

VISIT_LABELS = {
    "follow_up": "follow-up visit",
    "report_review": "report review",
    "routine_check": "routine check-up",
}


def visit_label(visit_type: str) -> str:
    return VISIT_LABELS.get(visit_type, VISIT_LABELS["follow_up"])


def render_message(
    first_name: str,
    date_pretty: str,
    visit_type: str,
    clinic_name: Optional[str] = None,
    doctor_name: Optional[str] = None,
    clinic_phone: Optional[str] = None,
) -> str:
    """Build the one and only patient-facing message.

    Every argument except `visit_type` (mapped through a fixed label dict)
    is plain, non-medical text controlled by us or by the clinic's own env
    config — never the doctor's free-text note.
    """
    clinic_name = clinic_name or os.getenv("CLINIC_NAME") or "Sharma Family Clinic"
    doctor_name = doctor_name or os.getenv("DOCTOR_NAME") or "Dr. Sharma"
    clinic_phone = clinic_phone or os.getenv("CLINIC_PHONE") or "9800000000"

    return MESSAGE_TEMPLATE.format(
        first_name=first_name,
        clinic_name=clinic_name,
        doctor_name=doctor_name,
        date_pretty=date_pretty,
        visit_label=visit_label(visit_type),
        clinic_phone=clinic_phone,
    )
