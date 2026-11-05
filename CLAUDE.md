# FollowUp — project memory

Hackathon build, due tomorrow. Full spec: `BUILD_PLAN.md` (read it before doing anything). This file is the short version.

## What it is
A clinic tool: doctor speaks one line ("Ramesh Kumar, review after 2 weeks") → we extract patient name, follow-up date, visit type → build a WhatsApp reminder from a fixed template → doctor taps Approve → receptionist sends via a wa.me link.

## Hard rules (never break)
1. No medical advice, diagnosis, medicine, dosage or treatment in any output, ever.
2. The AI only extracts fields (name, date, visit type, no_follow_up). It never writes patient-facing text.
3. Patient messages come only from the fixed templates in `backend/app/templates.py`. The doctor's raw note is never copied into a message.
4. Doctor flow = tap mic → speak → tap Approve. Under 15 seconds. No forms.
5. Fictional patient data only.

## Stack
- Backend: FastAPI + SQLModel + SQLite, Python 3.11+, in `backend/`
- Frontend: React + Vite + Tailwind, in `frontend/`
- AI: Anthropic Python SDK, model from `ANTHROPIC_MODEL` env var; rule-based fallback when no key
- Voice: browser Web Speech API (`en-IN`) + text box fallback
- WhatsApp: `https://wa.me/91<phone>?text=<urlencoded>`

## Commands (keep these up to date as the project is scaffolded)
- Backend dev: `cd backend && uvicorn app.main:app --reload --port 8000`
- Backend tests: `cd backend && pytest -q`
- Reset + seed DB: `cd backend && python -m app.seed`
- Frontend dev: `cd frontend && npm run dev` (port 5173)

## How we work
- The main session orchestrates; subagents in `.claude/agents/` do the work (see BUILD_PLAN section 0).
- `backend-builder` only touches `backend/`; `frontend-builder` only touches `frontend/`.
- BUILD_PLAN section 8 is the API contract between them.
- Run `safety-auditor` after any change to extractor, safety or templates.
- Use the context7 MCP for current library docs instead of guessing APIs.
- Stop after each phase and wait for the user's "go".
- Never commit `.env` or API keys.
