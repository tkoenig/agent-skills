---
name: pi-session-query
description: Query previous pi sessions to retrieve context, decisions, code changes, or other information. Use when you need to look up what happened in a parent session or any other session file.
---

# Session Query

Query pi session files to retrieve context from past conversations.

This skill is useful in handed-off sessions when you need to look up details from the parent session.

## Session Location

Sessions are stored in `~/.pi/agent/sessions/` organized by project path:

```
~/.pi/agent/sessions/
└── --Users-tom-Development-project--/
    ├── 2026-01-30T13-35-24-275Z_<uuid>.jsonl
    └── 2026-02-01T09-12-00-000Z_<uuid>.jsonl
```

To find recent sessions for a project:
```bash
ls -lt ~/.pi/agent/sessions/--Users-tom-Development-project--/ | head -10
```

## Usage

Run the `session-query` tool:

```bash
SKILL_DIR="$(dirname "$0")"
"$SKILL_DIR/tools/session-query" <session-path> <question>
```

Or if globally linked:

```bash
~/.pi/agent/skills/pi-session-query/tools/session-query <session-path> <question>
```

- `session-path`: Full path to the session file (e.g., from "Parent session:" line)
- `question`: What you want to know about that session

## Examples

```bash
# Find what files were modified
~/.pi/agent/skills/pi-session-query/tools/session-query /path/to/session.jsonl "What files were modified?"

# Understand the approach taken
~/.pi/agent/skills/pi-session-query/tools/session-query /path/to/session.jsonl "What approach was chosen for authentication?"

# Get a summary
~/.pi/agent/skills/pi-session-query/tools/session-query /path/to/session.jsonl "Summarize the key decisions made"
```

The tool extracts the conversation from the session and uses an LLM to answer your question. Ask specific questions for best results.

## Source

Extracted from https://github.com/pasky/pi-amplike/tree/main/skills/session-query
