---
name: sentry
description: "Manage Sentry issues using sentry-cli and the Sentry API. List, resolve, mute, and unresolve issues. Get detailed issue information. Use for error tracking, issue triage, and managing application errors in Sentry."
---

# Sentry CLI

Manage Sentry issues via the `sentry` wrapper script and the REST API.

## Quick Reference

```bash
{baseDir}/scripts/sentry config                              # Show current config
{baseDir}/scripts/sentry projects                            # List available projects
{baseDir}/scripts/sentry issues list --query "is:unresolved" # List open issues
{baseDir}/scripts/sentry issues resolve --id <ID>            # Resolve an issue
{baseDir}/scripts/sentry issues mute --id <ID>               # Mute an issue
```

## Setup

The wrapper script wraps `sentry-cli` and finds `.sentryclirc` in parent directories, enabling per-org/project tokens.

### Directory-Based Config

Place `.sentryclirc` files in parent directories for different orgs. Configs are **merged** from root to current directory, so you can set org-wide defaults and override per-project:

```
~/Development/
├── org-a/
│   ├── .sentryclirc          # org-a token + org name
│   ├── project-1/
│   │   └── .sentryclirc      # just: project=project-1
│   └── project-2/
│       └── .sentryclirc      # just: project=project-2
└── org-b/
    ├── .sentryclirc          # org-b token + org name
    └── project-3/
```

Parent config (e.g., `~/Development/org-a/.sentryclirc`):
```ini
[auth]
token=sntryu_xxx

[defaults]
org=my-org
```

Project-specific override (e.g., `project-1/.sentryclirc`):
```ini
[defaults]
project=project-1
```

### Verify Setup

```bash
# Show current configuration (wrapper command)
sentry config

# Verify token works with Sentry
sentry info

# List available projects in your org
sentry projects
```

## List Issues

```bash
# List all issues (default: up to 5 pages of 100 issues)
sentry issues list

# List only unresolved issues
sentry issues list --query "is:unresolved"

# List resolved issues
sentry issues list --query "is:resolved"

# Limit output rows
sentry issues list --query "is:unresolved" --max-rows 10

# Filter by status flag (alternative to query)
sentry issues list --status unresolved
```

## Resolve Issues

```bash
# Resolve a specific issue by ID
sentry issues resolve --id 7055684245

# Resolve multiple issues
sentry issues resolve --id 123456 --id 789012

# Resolve all unresolved issues (use with caution)
sentry issues resolve --status unresolved

# Resolve in next release only
sentry issues resolve --id 123456 --next-release
```

## Mute Issues

```bash
# Mute a specific issue
sentry issues mute --id 123456

# Mute all issues with a specific status
sentry issues mute --status unresolved
```

## Unresolve Issues

```bash
# Re-open a resolved issue
sentry issues unresolve --id 123456
```

## Search Query Syntax

The `--query` flag supports Sentry's search syntax:

| Query                    | Description                          |
| ------------------------ | ------------------------------------ |
| `is:unresolved`          | Unresolved issues                    |
| `is:resolved`            | Resolved issues                      |
| `is:ignored`             | Ignored/muted issues                 |
| `level:error`            | Error level only                     |
| `level:warning`          | Warning level only                   |
| `firstSeen:-24h`         | First seen in last 24 hours          |
| `lastSeen:-7d`           | Last seen in last 7 days             |
| `assigned:me`            | Assigned to you                      |
| `assigned:none`          | Unassigned                           |

Combine filters: `is:unresolved level:error lastSeen:-24h`

Full syntax: https://docs.sentry.io/concepts/search/

## Sentry API

The CLI doesn't support fetching detailed issue information. Use the REST API instead.

Get the auth token (walks up directory tree like the wrapper):
```bash
find_sentryclirc() {
  local dir="$PWD"
  while [[ "$dir" != "/" ]]; do
    [[ -f "$dir/.sentryclirc" ]] && echo "$dir/.sentryclirc" && return
    dir="$(dirname "$dir")"
  done
  echo ~/.sentryclirc
}
SENTRY_AUTH_TOKEN=$(grep -A1 '^\[auth\]' "$(find_sentryclirc)" | grep token | cut -d'=' -f2 | tr -d ' ')
```

### Get Issue Details

```bash
# Get full issue details by numeric ID (not short ID like PROJECT-1Q)
curl -s -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  "https://sentry.io/api/0/issues/<ISSUE_ID>/" | jq

# Get specific fields
curl -s -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  "https://sentry.io/api/0/issues/<ISSUE_ID>/" | jq -r '{
    shortId,
    title,
    culprit,
    count,
    firstSeen,
    lastSeen,
    query: .metadata.value
  }'
```

### API Reference

- [Retrieve an Issue](https://docs.sentry.io/api/events/retrieve-an-issue/)
- [Full API docs](https://docs.sentry.io/api/)

## Global Options

These work with all commands:

| Option                     | Description                                   |
| -------------------------- | --------------------------------------------- |
| `-o, --org <ORG>`          | Override organization (default from config)   |
| `-p, --project <PROJECT>`  | Override project (default from config)        |
| `--auth-token <TOKEN>`     | Override auth token                           |
| `--quiet`                  | Suppress output (for scripts)                 |
| `--log-level <LEVEL>`      | Set verbosity: trace, debug, info, warn, error |

## Common Workflows

### After Deploying a Fix

```bash
# List unresolved issues
sentry issues list --query "is:unresolved"

# Resolve the specific issue you fixed
sentry issues resolve --id <ISSUE_ID>
```

### Weekly Triage

```bash
# See all unresolved errors from the past week
sentry issues list --query "is:unresolved lastSeen:-7d"

# Mute noisy issues you can't fix right now
sentry issues mute --id <ISSUE_ID>
```

## Help

```bash
sentry --help
sentry issues --help
sentry issues list --help
sentry issues resolve --help
```

## Troubleshooting

### "Invalid token" or 401 Errors

Check your configuration:
```bash
sentry config
```

Verify the token works:
```bash
sentry info
```

If this fails, your token may be expired or invalid. Generate a new one at:
https://sentry.io/settings/account/api/auth-tokens/

### "Project does not exist" Errors

The project slug in your `.sentryclirc` may not match the actual Sentry project.

List available projects:
```bash
sentry projects
```

Then update your `.sentryclirc` with the correct project slug.

### Config Not Being Found

The wrapper walks up from your current directory looking for `.sentryclirc`. Make sure:

1. You're in a subdirectory of where `.sentryclirc` is located
2. The file is named exactly `.sentryclirc` (not `.sentrycli.rc` etc.)
3. The INI format is correct:

```ini
[auth]
token=sntryu_xxx

[defaults]
org=my-org
project=my-project
```

### Debug Mode

For verbose output, add `--log-level=debug`:
```bash
sentry --log-level=debug issues list
```
