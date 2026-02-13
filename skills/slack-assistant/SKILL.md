---
name: slack-assistant
description: Send Slack messages as the authenticated user via CLI and SLACK_USER_TOKEN.
---

# Slack Assistant

Use when you want to send Slack messages as the user who authorized the app.

CLI commands are relative to this skill directory (use `{baseDir}`).

## Confirmation

Always ask for confirmation before sending a message.

## Requirements

- `SLACK_USER_TOKEN` is set (`xoxp-...`).
- `SLACK_USER_NAME` is the username of the authenticated user (e.g., `tomk`).
- Token has `chat:write` scope (and `channels:read`/`groups:read`/`users:read` / `im:history`if needed).

## Current User

You are sending messages as `$SLACK_USER_NAME`.

## List users

```bash
bash {baseDir}/scripts/slack-assistant list-users
```

## Check presence

```bash
bash {baseDir}/scripts/slack-assistant presence --user U12345678
```

## Send a message to a channel

```bash
bash {baseDir}/scripts/slack-assistant send-channel --channel C12345678 --text "Hello"
```

## Send a DM

If the recipient is unclear, list users to identify the correct user ID before sending (no confirmation needed for listing users).

Before asking for confirmation to send the DM, check and report the recipient's presence status.

```bash
bash {baseDir}/scripts/slack-assistant dm --user U12345678 --text "Hello"
```

## Formatting (mrkdwn)

Slack uses "mrkdwn" format, NOT Markdown. Key differences:

| Format | Slack mrkdwn | NOT Markdown |
|--------|--------------|--------------|
| Bold | `*bold*` | ~~`**bold**`~~ |
| Italic | `_italic_` | ~~`*italic*`~~ |
| Strike | `~strike~` | ~~`~~strike~~`~~ |
| Code | `` `code` `` | (same) |
| Code block | ` ```code``` ` | (same) |
| Link | `<url\|text>` | ~~`[text](url)`~~ |
| Bullet | `• item` or `- item` | (same) |

Example:
```
*PR Review: v2/legacy cleanup (#499)*

• Removes unused helpers - _nice cleanup_
• See <https://github.com/org/repo/pull/499|PR #499>
```

## Shell quoting (important)

When passing `--text` in a shell command, wrap the message in single quotes or `$'...'` so backticks and `$` aren’t executed by the shell. Backticks inside double quotes will trigger command substitution and strip text.

Example:
```bash
bash {baseDir}/scripts/slack-assistant dm --user U12345678 --text $'Use `code` and $vars safely.'
```

If the message contains single quotes, escape them or use a different quoting strategy.
