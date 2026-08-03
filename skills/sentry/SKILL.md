---
name: sentry
description: "Manage Sentry issues using the modern Sentry CLI from https://cli.sentry.dev/. List and inspect issues, view events, use Seer AI explain/plan, browse projects, and make authenticated API requests. Use for error tracking, issue triage, and Sentry diagnostics."
---

# Sentry CLI

Use the modern `sentry` CLI from <https://cli.sentry.dev/> for Sentry work.

Prefer dedicated `sentry` commands over raw REST calls. Use `sentry api` only when no dedicated command exists.

## Install / verify

```bash
# Preferred install on macOS
brew install getsentry/tools/sentry

# Verify without printing token details
sentry --version
sentry org list --json --fields slug,name
```

If not authenticated, ask the user to run:

```bash
sentry auth login
```

Do **not** read, print, grep, or copy auth tokens. Avoid `sentry auth status` in agent transcripts because it may display partial token details. The CLI manages credentials locally.

## Agent rules

- Just run the relevant `sentry` command first; the CLI auto-detects org/project from config, DSNs, `.env`, and source code.
- Do not pre-fetch tokens or inspect secret files.
- Prefer singular noun commands: `sentry issue ...`, `sentry project ...`, `sentry org ...`.
- Use `--json` and `--fields` for machine-readable, low-noise output.
- Use `--limit` to keep output small.
- If auto-detection is wrong, retry with explicit `<org>/<project>`.
- Ask before mutating state: resolving, unresolving, archiving, merging, deleting, starting trials, or changing project/org settings.

## Quick reference

```bash
sentry org list --json --fields slug,name            # Check auth and list orgs safely
sentry project list <org> --json                     # List projects
sentry issue list --query "is:unresolved" --limit 10 # List unresolved issues
sentry issue view <ISSUE>                            # Inspect issue details
sentry issue events <ISSUE> --limit 5                # List events for an issue
sentry issue explain <ISSUE>                         # Seer AI root-cause analysis
sentry issue plan <ISSUE>                            # Seer AI fix plan
sentry issue resolve <ISSUE>                         # Resolve issue, after user confirmation
sentry issue unresolve <ISSUE>                       # Reopen issue, after user confirmation
sentry issue archive <ISSUE>                         # Archive/ignore, after user confirmation
sentry schema <resource>                             # Explore supported API resources
sentry api <endpoint>                                # Authenticated API request
```

Issue identifiers can usually be full IDs, short IDs like `PROJECT-123`, suffixes, or aliases returned by `sentry issue list`.

## Common workflows

### Investigate recent issues

```bash
sentry issue list --query "is:unresolved" --sort date --limit 10 --json \
  --fields shortId,title,level,status,count,lastSeen,permalink
```

Then inspect the relevant issue:

```bash
sentry issue view <ISSUE>
sentry issue events <ISSUE> --limit 5
```

If the user asks for AI assistance or root-cause analysis:

```bash
sentry issue explain <ISSUE>
sentry issue plan <ISSUE>
```

### Resolve after a fix

Confirm with the user first, then:

```bash
sentry issue resolve <ISSUE>
```

### Query the API

Use `sentry api` instead of manually building curl commands with tokens:

```bash
# Endpoints are relative to /api/0/
sentry api organizations/ --json
sentry api issues/<ISSUE_ID>/ --json

# Update issue status, after user confirmation
sentry api issues/<ISSUE_ID>/ -X PUT -F status=resolved
```

Use `sentry schema` to discover endpoints:

```bash
sentry schema issues
sentry schema releases
```

## Search query syntax

The `--query` flag supports Sentry search syntax:

| Query | Description |
| --- | --- |
| `is:unresolved` | Unresolved issues |
| `is:resolved` | Resolved issues |
| `is:ignored` | Ignored/archived issues |
| `level:error` | Error level only |
| `level:warning` | Warning level only |
| `firstSeen:-24h` | First seen in last 24 hours |
| `lastSeen:-7d` | Last seen in last 7 days |
| `assigned:me` | Assigned to you |
| `assigned:none` | Unassigned |

Combine filters with spaces, e.g.:

```bash
sentry issue list --query "is:unresolved level:error lastSeen:-24h"
```

Full syntax: <https://docs.sentry.io/concepts/search/>

## Time filtering

Many commands support `--period`:

```bash
sentry issue list --period 7d
sentry issue list --period "2026-04-01..2026-05-01"
sentry issue events <ISSUE> --period 24h
```

## Legacy fallback

This skill used to wrap the older `sentry-cli` binary.

Files in this skill:

```bash
<skill-dir>/scripts/sentry              # Compatibility launcher; prefers modern `sentry`
<skill-dir>/scripts/sentry-cli-wrapper  # Legacy wrapper around `sentry-cli`
```

Use the legacy wrapper only if the modern CLI is unavailable or a workflow specifically needs old `sentry-cli` behavior:

```bash
<skill-dir>/scripts/sentry-cli-wrapper config
<skill-dir>/scripts/sentry-cli-wrapper projects
<skill-dir>/scripts/sentry-cli-wrapper issues list --query "is:unresolved"
```

The compatibility launcher routes old plural commands (`issues`, `projects`, `config`) to the legacy wrapper and modern commands (`issue`, `project`, `org`, `api`, etc.) to the new `sentry` binary.

You can force legacy behavior with:

```bash
SENTRY_SKILL_LEGACY=1 <skill-dir>/scripts/sentry issues list
```

## Troubleshooting

### Not authenticated

Check safely:

```bash
sentry org list --json --fields slug,name
```

If needed, ask the user to run:

```bash
sentry auth login
```

### Wrong org/project detected

Retry with an explicit target:

```bash
sentry issue list <org>/<project> --query "is:unresolved"
sentry issue list <org>/ --query "is:unresolved" # all projects in org
```

### Need compact or script-friendly output

```bash
sentry issue list --json --fields shortId,title,status,lastSeen --limit 10
```

### Need current Sentry status

```bash
curl -s https://status.sentry.io/history.rss
```

Status page: <https://status.sentry.io>

## Docs

- CLI homepage: <https://cli.sentry.dev/>
- Getting started: <https://cli.sentry.dev/getting-started/>
- Agent guidance: <https://cli.sentry.dev/agent-guidance/>
- Issue commands: <https://cli.sentry.dev/commands/issue/>
- API command: <https://cli.sentry.dev/commands/api/>
