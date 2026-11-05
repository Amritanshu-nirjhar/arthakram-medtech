# FollowUp — 15-Second Clinic Follow-Up Tool

Hackathon build. Full spec in `BUILD_PLAN.md` (gitignored locally, not pushed — ask the project owner for a copy if needed).

## What it is

A clinic tool: the doctor speaks one short line ("Ramesh Kumar, review after 2 weeks") → the system extracts patient name, follow-up date and visit type → builds a ready-to-send WhatsApp reminder from a fixed template → the doctor taps Approve → the receptionist sends it via a `wa.me` click-to-send link.

The AI only ever extracts three structured fields. It never writes the patient-facing message — that always comes from a fixed template, checked by a safety validator before anything is saved.

## Stack

- Backend: FastAPI + SQLModel + SQLite (Python 3.11+), in `backend/`
- Frontend: React + Vite + Tailwind CSS, in `frontend/`
- AI: Anthropic Claude API for extraction, with a rule-based fallback when no API key is set
- Voice: browser Web Speech API (`en-IN`) + text box fallback
- WhatsApp: `https://wa.me/91<phone>?text=<urlencoded message>`

## Setup

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in ANTHROPIC_API_KEY later; fallback parser works without it
uvicorn app.main:app --reload --port 8000
```

Health check: `curl http://localhost:8000/health`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Opens on http://localhost:5173.

## Status

Project scaffold (Phase A). Backend is a minimal FastAPI app with CORS + `/health`. Frontend is a Vite + React + Tailwind app with `src/pages/`, `src/components/` and `src/api.js` stubbed out. Core features (extraction, safety guard, templates, doctor/reception/dashboard screens) land in Phase B.
