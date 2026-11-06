#!/usr/bin/env bash
# One command to run FollowUp: sets up the backend if needed, then starts backend + frontend.
# Ctrl+C stops both.
set -e
cd "$(dirname "$0")"

if [ ! -d backend/.venv ]; then
  echo "→ creating backend venv + installing deps (first run only)"
  python3 -m venv backend/.venv
  backend/.venv/bin/pip install -q -r backend/requirements-voice.txt
fi
[ -f backend/.env ] || cp backend/.env.example backend/.env
[ -f backend/followup.db ] || (cd backend && .venv/bin/python -m app.seed)
[ -d frontend/node_modules ] || (cd frontend && npm install --silent)

trap 'kill 0' EXIT
(cd backend && .venv/bin/uvicorn app.main:app --port 8000) &
(cd frontend && npm run dev -- --port 5173) &
[ "$1" = "--phone" ] && (cd frontend && npm run dev:phone) &

echo ""
echo "  FollowUp →  http://localhost:5173"
[ "$1" = "--phone" ] && echo "  On phone →  https://$(ipconfig getifaddr en0 2>/dev/null || hostname -I | awk '{print $1}'):5174"
echo ""
wait
