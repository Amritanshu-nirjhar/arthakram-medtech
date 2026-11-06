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

## Quick start

```bash
./dev.sh            # sets everything up on first run, then starts backend + frontend
./dev.sh --phone    # also serves https://<laptop-ip>:5174 so the mic works on a phone
```

Voice is transcribed on our own backend with faster-whisper (runs locally, no API key; the model downloads once, about 150 MB, on first start). If it is not installed, the app falls back to the browser's speech recognition.

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

Opens on http://localhost:5173. API calls go through `/api`, which Vite proxies to the backend on port 8000.

**Demo on a phone:** the mic only works over HTTPS, so run `npm run dev:phone`, open the `https://<laptop-ip>:5174` address it prints on the phone (same Wi-Fi), and accept the self-signed certificate warning.

Reset + seed the demo DB: `cd backend && python -m app.seed` · Tests: `cd backend && pytest -q`

## Screens

- `/` — landing page that tells the story (scroll it before the live demo)
- `/doctor` — mic → speak → Approve, with a stopwatch
- `/reception` — queue, Send on WhatsApp, mark confirmed / visited / missed
- `/dashboard` — live stats + editable value calculator

## Assumptions

50 patients/day, 26 working days, 40% need a follow-up (520/month), 30% missed today (156), ₹500 consult fee (₹78,000/month lost). Target miss rate 15% → ~78 visits / ₹39,000 recovered per month. Price ₹999/month. Clinic closed Sundays, so dates that land on a Sunday move to Monday. All patient data is fictional.

## 2-minute demo script

1. **Doctor** (`/doctor`): say *"Ramesh Kumar, review after 2 weeks"* → Approve in under 10 seconds (stopwatch visible).
2. Say *"Anil Verma, BP high, started amlodipine 5mg, review in 10 days"* → the message has no medicine, dose or diagnosis.
3. Say *"Amit, 1 week"* → two Amits appear as chips → tap the right one → Approve.
4. **Reception** (`/reception`): Send on WhatsApp for the demo patient (set `DEMO_PHONE` in `backend/.env` and re-seed) → it arrives on the phone.
5. **Dashboard** (`/dashboard`): show ₹ recovered per month.

Full pitch: `PITCH.md`.
