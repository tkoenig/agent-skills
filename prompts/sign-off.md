---
description: Review outstanding work and prepare to sign off
---

Help me wrap up this work session:

1. Inspect
   Check Git status and upstream ahead/behind in the current repository,
   even in a fresh session. Also check repositories worked in during this
   session; do not scan other projects. Identify outstanding changes,
   unpushed commits, missing upstreams, unfinished tasks, and session
   processes. Do not stop processes.

2. Establish context
   Distinguish this session’s work from earlier or unattributed changes.
   If ownership, intent, or completion is unclear, launch one quick,
   read-only async historian subagent. Search recent project sessions,
   then global session logs for exact file paths if needed. Recover any
   keep-local instructions and flag active writers or ambiguity.
   Do not expand repository scope or delegate further. Await completion
   without polling.

3. Propose
   Present a short commit/push plan: repositories, files, and purpose.
   Flag unrelated changes and unresolved questions separately. Ask one
   concrete approval question before staging, committing, or pushing.
   Read-only investigation needs no approval.

4. Publish only after approval
   Include only explicitly approved, understood work. Check for secrets,
   coordinate with active writers, stage explicit paths, and run relevant
   lightweight checks. Respect keep-local instructions. No source fixes,
   generated docs, force-pushes, or guessed upstreams; report blockers.

5. Verify and report
   Recheck Git status and upstream ahead/behind. Finish in 3–5 short lines.
   Use ✅ only when approved work is committed and pushed and nothing
   remains outstanding in the checked repositories; otherwise use ❌
   and state what remains. If nothing needed publishing, say so without
   implying a commit or push occurred. Never claim completion while
   a subagent or push is still running.
