---
name: pi-session-query
description: Query previous pi sessions to retrieve context, decisions, code changes, or other information. Use when you need to look up what happened in a parent session or any other session file.
---

# Session Query

Query pi session files to retrieve context from past conversations.

This skill is useful in handed-off sessions when you need to look up details from the parent session.

## Workflow: Search First, Then Query

**Always search before querying.** Don't guess session files by timestamp — use `session-search` to find the right one, then `session-query` to extract details.

## Session Location

Sessions are stored in `~/.pi/agent/sessions/` organized by project path:

```
~/.pi/agent/sessions/
└── --Users-tom-Development-project--/
    ├── 2026-01-30T13-35-24-275Z_<uuid>.jsonl
    └── 2026-02-01T09-12-00-000Z_<uuid>.jsonl
```

## Tools

### session-search — Find sessions by keyword (fast)

Search across all sessions using ripgrep. Returns matching sessions sorted by most recent, with project, date, first user message, and full path.

```bash
~/.pi/agent/skills/pi-session-query/tools/session-search <query> [--project <fragment>] [--limit <n>]
```

Examples:

```bash
# Find sessions about CORS
~/.pi/agent/skills/pi-session-query/tools/session-search cors

# Scope to a specific project
~/.pi/agent/skills/pi-session-query/tools/session-search 'deploy' --project labs-ai

# Get more results
~/.pi/agent/skills/pi-session-query/tools/session-search 'authentication' --limit 20
```

### session-query — Query a specific session (LLM-powered)

Once you have the session path from `session-search`, query it for details:

```bash
~/.pi/agent/skills/pi-session-query/tools/session-query <session-path> <question>
```

Examples:

```bash
# Find what files were modified
~/.pi/agent/skills/pi-session-query/tools/session-query /path/to/session.jsonl "What files were modified?"

# Understand the approach taken
~/.pi/agent/skills/pi-session-query/tools/session-query /path/to/session.jsonl "What approach was chosen for authentication?"

# Get a summary
~/.pi/agent/skills/pi-session-query/tools/session-query /path/to/session.jsonl "Summarize the key decisions made"
```

## Source

Extracted from https://github.com/pasky/pi-amplike/tree/main/skills/session-query
