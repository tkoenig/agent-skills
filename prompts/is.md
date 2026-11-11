---
description: Verify a GitHub issue and propose the smallest useful change
argument-hint: "<github-issue-link>"
---

Analyze: $@

Use GitHub CLI to read the issue and relevant discussion. Treat supplied analysis as a hypothesis: verify it against the implementation, callers, and existing tests. Read linked material or wider code only when it resolves a concrete uncertainty.

Explain the actual problem, the smallest coherent fix, and any decision needed from me. For a feature, identify affected areas and existing patterns worth reusing. Say when the report is already fixed, incorrect, or unsupported.

Analyze only. Do not implement, publish, or create a planning document unless asked.
