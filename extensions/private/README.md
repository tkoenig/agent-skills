# Private local chat

`/private` opens a **fresh Ghostty window** running the installed
`mlx-core/mlx-community/Qwen3.8-27B-4bit` model. Ask your private question in that
window, not as an argument to `/private`. Each invocation starts a new chat;
it does not locate or resume earlier private windows.

## Activation

This extension is listed in `global_extensions` in this repository's `config.yml`.
The global link is `~/.pi/agent/extensions/private` → this directory. After linking,
run `/reload` in existing Pi sessions. No dotfiles `settings.json` entry is needed.
To load it for one session without a global link:

```sh
pi --extension /path/to/agent-skills/extensions/private/index.ts
```

Requires Ghostty 1.3+ with macOS Automation permission, the existing
`~/.pi/agent/extensions/mlx-core` provider, its managed `mlx-serve` installation,
and the already-downloaded Qwen model. This feature installs no software or
models. MLX starts lazily on the first message.

The machine-local personal-data routing instruction in `~/.pi/agent/AGENTS.md`
recommends `/private` rather than manual launch.
The private runtime supplies its own instructions instead of loading that file.

## Boundaries

- No parent prompt, history, working directory, credentials, or session IDs are
  forwarded. The launcher accepts only the installed Pi executable path.
- Fresh profile under `~/.pi-private/run-*` (mode 0700), empty auth storage,
  allowlisted environment, no discovered extensions/skills/context/templates.
- Only the private guard and existing MLX provider load. No Intercom, subagents,
  MCP, remote research, or automatic result/completion handoff.
- Pinned local model, offline catalog behavior, no automatic retries or
  compaction. Guards terminate the private process on unapproved model
  selection/request, saved-session use, or tool activation. They use process
  termination because Pi can swallow exceptions from extension hooks.
- **No tools are enabled. Contacts access is not implemented.** This initial
  version supports direct local conversation and explicitly supplied input.
  Scoped read-only Contacts access should be added and reviewed separately.
- Pi session persistence is disabled (`--no-session`). Closing the window loses
  the conversation. The isolated profile contains configuration, not an intended
  transcript archive. Terminal scrollback, MLX/server logs, and explicit user
  exports can still remain locally.
- This is **not an OS sandbox or network firewall**. It trusts the local Pi,
  Ghostty, and MLX implementations and the user's machine. `--offline` alone
  does not prevent model HTTP requests. Other processes running as this user
  can still access local files. The ordinary cloud session's personal-data
  restriction remains an instruction, not an OS access boundary.

The launcher deliberately has no cloud fallback, shell tools, reuse/resume,
Contacts automation, or transcript export to the originating session. Wait for
`PRIVATE · local Qwen` in Pi's status before entering personal information.
An error window is not a verified private session.

## Files

- `index.ts`: parent-side slash command; opens Ghostty only.
- `launch.mjs`: creates the isolated profile and launches Pi in the terminal.
- `runtime.ts`: loads the MLX provider and installs fail-closed guards.
- `guards.mjs`, `policy.mjs`: guard logic and fixed launch policy.
- `SYSTEM.md`: private session instructions.

## Validation

```sh
node --test extensions/private/private.test.mjs
node extensions/private/smoke.mjs "$(mise which pi)"
```

The smoke test uses only synthetic text. It verifies that an unapproved provider
pointing at a loopback HTTP trap receives **zero requests**, then asks local Qwen
for a fixed canary reply and checks that Pi saved no JSONL transcript. It leaves
a synthetic-only temporary profile for inspection. Move unwanted profiles to
macOS Trash; never commit runtime profiles, logs, or personal data.
