"""Fuzzy patient-name matching (BUILD_PLAN section 5/9).

Returns EVERY candidate above the threshold, highest score first, so that
an ambiguous name (two "Amit"s) comes back as a list for the doctor to
tap-to-choose, instead of silently guessing one.

A doctor usually says just a first name ("Amit", "Kavita") or a full name
("Ramesh Kumar"). Scoring the whole query against the whole candidate
name with a single fuzzy ratio makes a one-word query match ANY patient
who merely shares a common surname with the right one (e.g. "Ramesh
Kumar" fuzzy-matching "Amit Kumar" on "Kumar" alone). To avoid that:
  - a multi-word query is compared against the candidate's full name
    (token_sort_ratio), so a different first name drags the score down a
    lot even with a shared surname.
  - a single-word query is compared against each individual name token
    of the candidate (plain ratio, best token wins), so it only matches
    patients who actually have a token close to that one word.
"""

from typing import List, Sequence

from rapidfuzz import fuzz

from .models import Patient

DEFAULT_THRESHOLD = 85


def _score(query: str, candidate_name: str) -> float:
    query_tokens = query.split()
    candidate_tokens = candidate_name.split()
    if len(query_tokens) >= 2:
        return fuzz.token_sort_ratio(query, candidate_name)
    return max((fuzz.ratio(query, token) for token in candidate_tokens), default=0.0)


def find_candidates(
    name: str,
    patients: Sequence[Patient],
    threshold: int = DEFAULT_THRESHOLD,
) -> List[Patient]:
    if not name or not name.strip():
        return []

    query = name.strip().lower()
    scored = []
    for patient in patients:
        score = _score(query, patient.name.lower())
        if score >= threshold:
            scored.append((score, patient))

    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [patient for _, patient in scored]
