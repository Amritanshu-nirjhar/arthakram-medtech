---
description: Run one build phase (A, B, C or D) from BUILD_PLAN.md using the subagents
argument-hint: A | B | C | D
---

Run Phase $ARGUMENTS from BUILD_PLAN.md section 0.

- Phase A: do Step 0 (summarise the plan in 5 lines and ask your questions — no code), then wait for my answers, then do Step 1 yourself (scaffold, git init, both servers boot).
- Phase B: launch `backend-builder` (Steps 2–5), `frontend-builder` (Steps 6–7 with the mock api.js) and `pitch-writer` (first draft) in parallel in a single message. When all three report back, summarise.
- Phase C: switch `frontend/src/api.js` to the real backend, start both servers, then launch `safety-auditor` and `qa-tester` in parallel. Summarise PASS/FAIL and list fixes needed.
- Phase D: send each fix from Phase C to the right builder, then Step 8 (dashboard) via `frontend-builder` (plus `/stats` via `backend-builder` if missing), then Step 9 polish, then `pitch-writer` for the final PITCH.md. Re-run `safety-auditor` at the end.

At the end of the phase: commit to git, then give me a short report (what was built, how to test it in under 5 commands, open issues) and wait for my "go".
