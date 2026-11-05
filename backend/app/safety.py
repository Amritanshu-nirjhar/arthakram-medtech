"""Final safety guard (BUILD_PLAN section 7, layer 3).

Runs on the final rendered message AND on every extracted field, before
anything is saved or returned to a client. Three checks:
  1. dosage patterns / words
  2. medicine name blocklist
  3. diagnosis word blocklist
Plus structural checks: patient_name must match a real DB patient, and
visit_type must be one of the 3 allowed enum values.
"""

import re
from typing import Iterable, List, Sequence, Tuple

from .models import VisitType

DOSAGE_PATTERN = re.compile(r"\d+\s?(?:mg|ml|mcg|g|iu)\b", re.IGNORECASE)

DOSAGE_WORDS = [
    "tablet",
    "tablets",
    "tab",
    "capsule",
    "capsules",
    "syrup",
    "injection",
    "dose",
    "dosage",
    "twice",
    "daily",
]

MEDICINE_BLOCKLIST = [
    "paracetamol",
    "amlodipine",
    "metformin",
    "azithromycin",
    "ibuprofen",
    "amoxicillin",
    "aspirin",
    "omeprazole",
    "atorvastatin",
    "cetirizine",
    "dolo",
    "crocin",
    "pantoprazole",
    "insulin",
]

DIAGNOSIS_BLOCKLIST = [
    "diabetes",
    "hypertension",
    "infection",
    "fever",
    "bp",
    "sugar",
    "cancer",
    "asthma",
    "tb",
    "tuberculosis",
    "covid",
    "malaria",
    "typhoid",
]


def _word_matches(text: str, words: Iterable[str]) -> List[str]:
    hits = []
    for word in words:
        if re.search(rf"\b{re.escape(word)}\b", text, re.IGNORECASE):
            hits.append(word)
    return hits


def find_blocked_terms(text: str) -> List[str]:
    """Return every blocklisted term found in `text` (empty list = clean)."""
    if not text:
        return []
    hits: List[str] = []
    hits.extend(m.group(0).strip() for m in DOSAGE_PATTERN.finditer(text))
    hits.extend(_word_matches(text, DOSAGE_WORDS))
    hits.extend(_word_matches(text, MEDICINE_BLOCKLIST))
    hits.extend(_word_matches(text, DIAGNOSIS_BLOCKLIST))
    # de-dupe, keep order
    seen = set()
    unique = []
    for h in hits:
        key = h.lower()
        if key not in seen:
            seen.add(key)
            unique.append(h)
    return unique


def is_message_safe(message: str) -> Tuple[bool, List[str]]:
    hits = find_blocked_terms(message)
    return (len(hits) == 0, hits)


def is_text_safe(value: str) -> Tuple[bool, List[str]]:
    """Same check, used on any single extracted field value."""
    return is_message_safe(value)


def is_extraction_safe(patient_name: str, visit_type: str = "") -> Tuple[bool, List[str]]:
    """Scan extracted fields (not just the final message) for blocked terms."""
    hits = find_blocked_terms(f"{patient_name} {visit_type}")
    return (len(hits) == 0, hits)


def visit_type_is_valid(visit_type: str) -> bool:
    try:
        VisitType(visit_type)
        return True
    except ValueError:
        return False


def patient_name_matches(name: str, known_names: Sequence[str]) -> bool:
    if not name:
        return False
    lowered = name.strip().lower()
    return any(lowered == n.strip().lower() for n in known_names)
