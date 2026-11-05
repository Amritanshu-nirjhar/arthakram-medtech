---
description: Run the safety auditor to prove no medical advice can reach a patient message
---

Launch the `safety-auditor` subagent. When it reports, show me the PASS/FAIL table. For every FAIL, send the fix to `backend-builder`, then run `safety-auditor` again until everything passes.
