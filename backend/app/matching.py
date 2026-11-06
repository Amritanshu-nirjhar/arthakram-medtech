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

import re
from typing import List, Sequence

from rapidfuzz import fuzz

from .models import Patient

DEFAULT_THRESHOLD = 85
FULL_NAME_THRESHOLD = 88
FIRST_NAME_THRESHOLD = 90


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


def find_in_text(text: str, patients: Sequence[Patient]) -> List[Patient]:
    """Find patients named anywhere in a free-form note.

    Used when the extractor couldn't pull a clean name ("review ramesh kumar
    after two weeks", "Please call Priya Sharma back"). A full-name match
    anywhere in the text wins; otherwise a first-name-only match ("Amit",
    "Kavita ko ...") returns every patient with that first name so the
    doctor taps the right one. Surnames alone never match.
    """
    words = re.findall(r"[a-z]+", (text or "").lower())
    full, first = [], []
    for patient in patients:
        tokens = patient.name.lower().split()
        n = len(tokens)
        windows = (" ".join(words[i : i + n]) for i in range(len(words) - n + 1))
        best_full = max((fuzz.ratio(w, " ".join(tokens)) for w in windows), default=0.0)
        if best_full >= FULL_NAME_THRESHOLD:
            full.append((best_full, patient))
            continue
        best_first = max((fuzz.ratio(w, tokens[0]) for w in words if len(w) >= 3), default=0.0)
        if best_first >= FIRST_NAME_THRESHOLD:
            first.append((best_first, patient))

    hits = full or first
    if not hits:
        return []
    top = max(score for score, _ in hits)
    hits = [h for h in hits if h[0] >= top - 3]  # keep near-ties for tap-to-choose
    hits.sort(key=lambda pair: pair[0], reverse=True)
    return [patient for _, patient in hits]
