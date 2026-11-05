"""Turn relative durations / day-names into a real calendar date.

The AI model is only ever allowed to extract raw fields (a number of days,
or an explicit day name already said in the note). The *final* date — the
one actually saved and shown to the patient — is always computed here, in
code, never by the model. That includes the "clinic closed on Sundays"
rule: if a computed date lands on a Sunday it is pushed to the next Monday.
"""

from datetime import date, timedelta
from typing import Optional, Union

WEEKDAYS = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}

SUNDAY = 6


def next_weekday(today: date, weekday_name: str) -> date:
    """Return the date of the next occurrence of `weekday_name` after today.

    "Next" means strictly in the future (today itself is never returned),
    matching how a doctor means "come back Monday" / "next Friday".
    """
    name = weekday_name.strip().lower()
    if name not in WEEKDAYS:
        raise ValueError(f"unknown weekday name: {weekday_name!r}")
    target = WEEKDAYS[name]
    days_ahead = (target - today.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7
    return today + timedelta(days=days_ahead)


def adjust_for_sunday(d: date) -> date:
    """Clinic is closed Sundays -> push to Monday."""
    if d.weekday() == SUNDAY:
        return d + timedelta(days=1)
    return d


def compute_final_date(
    today: date,
    follow_up_in_days: Optional[int] = None,
    follow_up_date: Optional[Union[str, date]] = None,
) -> Optional[date]:
    """Compute the final, Sunday-adjusted follow-up date.

    Priority: an explicit `follow_up_date` (already parsed from the note,
    e.g. a day name or calendar date) wins over a relative day count.
    Returns None if neither is available (caller should prompt the doctor
    to pick a duration).
    """
    if follow_up_date:
        d = (
            date.fromisoformat(follow_up_date)
            if isinstance(follow_up_date, str)
            else follow_up_date
        )
    elif follow_up_in_days is not None:
        d = today + timedelta(days=follow_up_in_days)
    else:
        return None
    return adjust_for_sunday(d)


def pretty_date(d: date) -> str:
    """Human-friendly date for the patient message, e.g. 'Thu, 19 Nov'."""
    return d.strftime("%a, %d %b")
