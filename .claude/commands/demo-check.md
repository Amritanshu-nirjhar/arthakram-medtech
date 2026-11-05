---
description: Rehearse the 2-minute demo end to end with the QA agent
---

Make sure both servers are running and the DB is freshly seeded (`cd backend && python -m app.seed`). Then launch the `qa-tester` subagent to walk through the demo script in BUILD_PLAN.md Step 9 exactly as a judge would see it. Report: PASS/FAIL per demo step, doctor time per note, and anything that looked slow, broken or confusing on screen.
