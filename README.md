# FollowUp — 15-Second Clinic Follow-Up Tool

Hackathon build. Full spec in `BUILD_PLAN.md`; the pitch is in `PITCH.md`.

## What it is

A clinic tool: the doctor speaks one short line ("Ramesh Kumar, review after 2 weeks") → the system extracts patient name, follow-up date and visit type → builds a ready-to-send WhatsApp reminder from a fixed template → the doctor taps Approve → the receptionist sends it via a `wa.me` click-to-send link.

The AI only ever extracts three structured fields. It never writes the patient-facing message — that always comes from a fixed template, checked by a safety validator before anything is saved.

## Stack

- Backend: FastAPI + SQLModel + SQLite (Python 3.11+), in `backend/`
- Frontend: React + Vite + Tailwind CSS, in `frontend/`
- AI: Anthropic Claude API for extraction, with a rule-based fallback when no API key is set
- Voice: recorded in the browser and transcribed on the backend with local faster-whisper; falls back to the browser Web Speech API (`en-IN`); text box always available
- WhatsApp: `https://wa.me/91<phone>?text=<urlencoded message>`

## Quick start

```bash
./dev.sh            # sets everything up on first run, then starts backend + frontend
./dev.sh --phone    # also serves https://<laptop-ip>:5174 so the mic works on a phone
```

Voice is transcribed on our own backend with faster-whisper (runs locally, no API key; the "small" model downloads once, about 480 MB, on first start; set WHISPER_MODEL=base for a faster, smaller one). If it is not installed, the app falls back to the browser's speech recognition.

## Deploy (Vercel, one project, two services)

`vercel.json` defines two services: `frontend` (Vite, public at `/`) and `backend` (FastAPI, public at `/api/*`). The browser calls the backend at `/api/...` on the same domain, so no service bindings are needed. Set `ANTHROPIC_API_KEY` (optional) and the `CLINIC_*` / `DOCTOR_NAME` variables in the Vercel project.

- Voice on Vercel uses the browser's speech recognition. Local Whisper (`backend/requirements-voice.txt`) is too large for a Vercel function, and `/api/transcribe` returns 503 there.
- The SQLite database lives in `/tmp` on Vercel and is re-seeded with the fictional demo data whenever a new function instance starts, so approvals are not durable across instances. Use Postgres for real use.

Test the whole deployment locally with `vercel dev`.

## Setup

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # optional: add ANTHROPIC_API_KEY; the fallback parser works without it
python -m app.seed      # reset + seed the database
uvicorn app.main:app --reload --port 8000
```

Health check: `curl http://localhost:8000/health`. For server-side speech-to-text also run `pip install -r requirements-voice.txt`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Opens on http://localhost:5173. API calls go through `/api`, which Vite proxies to the backend on port 8000.

**Demo on a phone:** the mic only works over HTTPS, so run `npm run dev:phone`, open the `https://<laptop-ip>:5174` address it prints on the phone (same Wi-Fi), and accept the self-signed certificate warning.

### Environment variables (`backend/.env`)

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Optional. If empty, extraction uses the rule-based fallback parser. |
| `ANTHROPIC_MODEL` | Model used for extraction (default `claude-sonnet-5-5`). |
| `CLINIC_NAME` | Appears in the reminder template. |
| `DOCTOR_NAME` | Appears in the reminder template. |
| `CLINIC_PHONE` | Reschedule number in the reminder template. |
| `DEMO_PHONE` | Assigned to one seed patient so a real message can be shown arriving during the demo. |
| `WHISPER_MODEL` | Local speech-to-text size: `small` (default, best for Hinglish) or `base` (faster). |

Never commit `.env`.

## Commands

| Task | Command |
|---|---|
| Everything at once | `./dev.sh` (add `--phone` for the HTTPS phone server) |
| Backend dev server | `cd backend && uvicorn app.main:app --reload --port 8000` |
| Backend tests | `cd backend && .venv/bin/pytest -q` |
| Reset + seed DB | `cd backend && python -m app.seed` |
| Frontend dev server | `cd frontend && npm run dev` |
| Frontend production build | `cd frontend && npm run build` |

## Screens

| Route | User | What it does |
|---|---|---|
| `/` | Everyone | Landing page that tells the story (scroll it before the live demo). |
| `/doctor` | Doctor | Mic button + live transcript (text box fallback), result card, tap chips for ambiguous names or missing dates, one Approve button, visible stopwatch from mic tap to Approve. |
| `/reception` | Receptionist | Queue of approved reminders by follow-up date, filters (Today / This week / All), **Send on WhatsApp**, and status buttons for confirmed / visited / missed. |
| `/dashboard` | Clinic owner | Reminders created / sent / confirmed / visited, average doctor seconds, and a value calculator with editable assumptions. |

## API

Every route is also served under `/api/...` (that's the path the frontend and Vercel use).

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness check (also reports whether server speech-to-text is available) |
| POST | `/transcribe` | Multipart `audio` → `{text}` via local faster-whisper; 503 when not installed (e.g. on Vercel). The text only ever goes to `/notes/parse`. |
| POST | `/notes/parse` | `{text}` → candidates, follow-up date, visit type, message preview, warnings |
| POST | `/messages/preview` | `{patient_id, follow_up_date, visit_type}` → `{message, warnings}`. Read-only re-render after the doctor taps a chip, so the frontend never builds patient text itself. |
| POST | `/reminders` | Approve a reminder (status `approved`) |
| GET | `/reminders?status=` | Receptionist queue |
| PATCH | `/reminders/{id}` | Update status (`sent`, `confirmed`, `visited`, `missed`) |
| DELETE | `/reminders/{id}` | Undo an approve, only while still `approved` (409 once sent) |
| GET | `/patients?search=` | Patient search for the tap-to-choose fallback |
| GET | `/stats` | Dashboard numbers |

## How the safety guarantee works

Three independent layers, so no single failure can put medical content in front of a patient:

1. **Extraction only** — the AI returns three structured fields (`patient_name`, date, `visit_type`) plus `no_follow_up`. It is never asked to write a sentence for a patient.
2. **Fixed templates** — the message is rendered from `backend/app/templates.py` using only first name, date, visit label, clinic name, doctor name and clinic phone. The doctor's raw note is never copied into a message. The template exists in exactly one place: the frontend never assembles patient text, it only displays what the server rendered (via `/notes/parse` or `/messages/preview`). `test_api.py` asserts the preview is byte-identical to what `POST /reminders` stores for the same inputs, so the message the doctor approves cannot drift from the one the patient receives.
3. **Final validator** — `backend/app/safety.py` re-scans the rendered message and every extracted field for dosage patterns, medicine names and diagnosis words before anything is saved, and checks `visit_type` against the 3-value enum and `patient_name` against the database.

`backend/tests/test_safety.py` proves this with adversarial notes, including a note containing `amlodipine 5mg` and a prompt-injection attempt telling the tool to recommend a medicine. Both must still yield a clean, template-only message.

## Assumptions

- 50 patients/day, 26 working days/month, ~40% need a follow-up → ~520 follow-ups/month.
- 30% missed today → ~156 missed visits/month; at ₹500 average consult fee → ~₹78,000/month lost.
- Target miss rate 15% → ~78 visits recovered → ~₹39,000/month recovered.
- Price: ₹999/month per clinic, paid by the clinic owner. Pays for itself after two recovered visits.
- The clinic is closed on Sundays — a follow-up date landing on a Sunday moves to Monday.
- All patient data is fictional.
- Sending is a `wa.me` click-to-send link the receptionist taps, not automated delivery.

## 2-minute demo script

1. **Doctor screen.** Tap mic, say *"Ramesh Kumar review after 2 weeks"*, tap Approve — stopwatch visible, under 10 seconds.
2. **Safety.** Say *"Anil Verma, BP high, started amlodipine 5mg, review in 10 days"* — the date is captured, and the message stays clean: no medicine, no dose, no diagnosis.
3. **Ambiguity.** Say *"Amit, 1 week"* — two patients match, the doctor taps the right one. Never a silent guess.
4. **Reception screen.** Open the queue, tap **Send on WhatsApp** for the demo patient — the message arrives on the presenter's phone.
5. **Dashboard.** Show reminders sent and ₹ recovered per month from the value calculator.

## What's next (not built)

- WhatsApp Business API for automatic sending and patient replies.
- Patient reply handling (YES to confirm) feeding back into the queue.
- Hindi/regional voice UI (Hinglish *extraction* already works and is tested).
