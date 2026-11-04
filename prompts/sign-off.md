---
description: Commit and push this session's work before stopping
---

Help me sign off and sleep well:

- Check Git status only in repositories we worked in during THIS session, including secondary repositories. Flag uncommitted changes, unpushed commits, missing upstreams, unfinished tasks, and processes from this session; do not stop anything.
- If changes need context, automatically launch ONE quick, read-only async historian subagent. Use recent Pi sessions only to explain outstanding changes in these repositories—not to expand the scope to other projects. Ask for a compact commit plan and any ambiguous files or active writers; no exhaustive history or further delegation. Yield for completion rather than polling.
- Before staging, committing, or pushing, summarize the proposed commits and repositories, using the historian's findings if consulted, and ask for approval. Only after approval, commit and push this session's understood, safe work: check for secrets, coordinate with active writers, stage explicit paths, and run relevant lightweight checks. Do not sweep in unrelated pre-existing work; flag it separately. No source fixes, generated docs, force-pushes, or guessed upstreams; report blockers rather than guessing.
- Recheck Git status and upstream ahead/behind. Keep the status brief, with a little context and plain language: ✅ if this session's work is committed AND pushed with no action remaining, otherwise ❌ with exactly what remains. If approval is needed, show a short proposed-commit list with repository, files, and purpose; list unresolved questions separately, then ask one concrete approval question. Do not ask permission merely to continue read-only review. Mention unrelated dirty files separately; never claim the whole repository is backed up when it isn't, or completion while a subagent or push is still running.
