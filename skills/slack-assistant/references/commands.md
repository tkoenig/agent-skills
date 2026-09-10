# SlackCLI commands and recovery

Checked against SlackCLI **0.11.0**. Adapted from the upstream [plugin reference](https://github.com/shaharia-lab/slackcli/blob/main/plugins/slackcli/skills/slackcli/references/commands.md) and [user guide](https://slackcli.dev/docs/user-guide/claude-code-plugin/). Installed `slackcli <group> <command> --help` wins if options differ.

## Invocation and scope

Commands below follow `{baseDir}/scripts/slack-assistant`, where `{baseDir}` is the skill root. Keep the calling directory unchanged. Only use `--workspace wearedevs|wollzelle` **before** the command for a user-requested override; never pass a raw Slack workspace selector or `--team` to bypass directory routing.

- `--json`: machine-readable stdout; progress and errors go to stderr. Use shell `pipefail` when filtering so a CLI failure is not hidden by a successful filter.
- Narrow queries and filter results **before** they reach the model. Keep IDs, names, relevant text and permalinks; omit unrelated profile fields, avatars and private download URLs.
- Empty results are not an error. A page of results is not necessarily the complete result set.
- `context` reports the local binding without contacting Slack. `team info --json` verifies live access; compare its team ID with the binding. `auth list` alone is not a live check and exits successfully even with no stored profiles.

## Supported reads

| Command | Useful options / behavior |
| --- | --- |
| `team info --json` | Workspace identity and live auth check; use the bound workspace, not `--team`. |
| `conversations list` | `--types=public_channel,private_channel,mpim,im`, `--limit=100`, `--exclude-archived`, `--cursor=...` |
| `conversations read CHANNEL_OR_URL` | `--limit=100`, `--thread-ts=TS`, `--oldest=UNIX`, `--latest=UNIX`, `--exclude-replies` |
| `conversations read --permalink=URL` | Read the linked message's thread. |
| `conversations get CHANNEL TS` | Retrieve a message; also accepts `--permalink=URL`. Browser auth supports resolving thread replies. |
| `conversations unread` | `--types=channels|dms|groups`; narrow if only one kind is needed. |
| `search messages 'QUERY'` | `--in=CHANNEL_NAME`, `--from=USERNAME`, `--limit=20`, `--page=1`, `--sort=timestamp|score`, `--sort-dir=desc|asc` |
| `search channels 'NAME'` / `search people 'NAME'` | Resolve names to IDs; `--limit=N`. Confirm ambiguous matches. |
| `saved list` | `--limit=N`, `--state=saved|to_do|completed` |
| `canvas list` / `canvas read FILE_OR_URL` | List: `--channel=C123`, `--limit=20`. Read also accepts `--channel=C123`. `--json` includes Markdown content. |
| `files info FILE_OR_URL` / `files read FILE_OR_URL` | Info contains private URLs: filter them out. Read is text-only, with a 10 MB cap. |

Use `--json` for all reads whose output you process. Commands not listed here, except the write/setup operations in the main skill, remain blocked by the wrapper. Do not bypass it to edit messages, react, download files, or change user groups.

### Search and pagination

Slack search operators work inside the query: `in:`, `from:`, `before:`, `after:`, `on:`, `during:`, `has:`, `is:`, `with:`. Prefer a channel, person or date bound instead of downloading broad histories.

- `search messages` returns `total`, `page`, `pages` and `matches`. Follow `--page` only as far as the task needs.
- `conversations list` returns `conversations`, `users` and `next_cursor`. Pass `--cursor` until it is empty/null when a complete list is required.
- `conversations read` returns `messages` and `users`, with messages oldest first. Respect the requested limit/date range; do not describe a limited history as exhaustive.

Example: return only recipient-identification fields instead of full profiles:

```bash
set -o pipefail
{baseDir}/scripts/slack-assistant search people 'toms' --json |
  python3 -c 'import json,sys; d=json.load(sys.stdin); print(json.dumps([{ "id": p["id"], "username": p.get("username"), "name": p.get("profile", {}).get("real_name") } for p in d.get("people", [])]))'
```

These optional-field guards are for external API data, not local model attributes. Preserve enough context to distinguish people with similar names.

### Thread targeting

Use a pasted Slack permalink rather than reconstructing timestamps. `--permalink` replaces recipient/channel and timestamp for reading or composing a thread reply; a link to a reply targets its parent thread. Do not accidentally turn a requested reply into a new top-level message.

## Drafts and approved sends

```text
draft --recipient-id=C_OR_U_ID --message='TEXT' --json
draft --permalink=URL --message-file=/absolute/path/message.txt --json
send-approved --recipient-id=C_OR_U_ID --message='APPROVED TEXT' --json
send-approved --permalink=URL --message='APPROVED REPLY' --json
```

A `U…` recipient opens a DM. For approved text-only sends, add `--blocks` with a `markdown` block containing the standard Markdown message; retain `--message`/`--message-file` as the notification/accessibility fallback. The examples above show targeting, not the default block payload. File attachments cannot accompany `--blocks`; use Slack markup with those sends and with drafts. Use `--message-file` for long fallback/draft text instead of fragile shell quoting. See the main skill for approval and attachments, and [block-kit.md](block-kit.md) for payload examples.

| Result | JSON handles to retain | Report |
| --- | --- | --- |
| Draft | `channel_id`, `draft_id` | Created in Slack; not sent. No message permalink yet. |
| Text/blocks send | `channel_id`, `ts`, usually `permalink` | Return the permalink if present. A missing permalink does not mean delivery failed. |
| File send | `channel_id`, `file_id` | Confirm the upload/send; no message timestamp or permalink is guaranteed. |

## Recovery

| Symptom | Action |
| --- | --- |
| Missing binary / unknown command or option | Check PATH, version and installed help. Ask before installing/upgrading via the macOS software-management workflow. Do not silently substitute another operation. |
| `team info` unavailable on an older version | A scoped `conversations list --limit=1 --json` can probe access; it does not independently verify team identity. Offer a Homebrew upgrade for the identity check. |
| No binding / profile not found / identity mismatch | Inspect `slackcli auth list`, confirm the correct workspace and bind explicitly. Never fall back to the global default. |
| `invalid_auth`, `not_authed`, `token_revoked`, `token_expired`, or a sign-in page when reading a canvas | Offer `slackcli auth login-auto --headless` for a previously signed-in browser profile; wait for approval. If it fails, offer interactive login. Then recheck local binding and live identity. |
| Draft requires browser auth / unsupported token type | Browser login is required for our draft workflow. Do not retry the same request with an unsuitable token. |
| `not_in_channel`, missing scope, access denied | Report the access problem. Do not auto-join, broaden scopes or reauthenticate as if the token expired. |
| `attached_draft_exists` | Ask the user to discard the old draft before recreating it; never delete automatically. |
| Slow requests / rate limiting | SlackCLI throttles requests. Narrow `--limit`/`--types` and wait; honor any retry delay rather than launching concurrent retries. |
| Network/server error | Report it separately from auth failure. For a write, inspect the destination before retrying if delivery is uncertain. |

Never ask for tokens or copied cURL requests in chat. Refresh/login may enroll multiple workspaces; keep the explicit directory bindings and verify the selected identity afterward. No automatic logout, credential removal or default-workspace changes.
