# Local-model Pi (`/private`)

`/private` opens a fresh Ghostty window running **normal Pi with local Qwen**.
It uses the same working directory and agent configuration directory, with the
normal tools, shell, files, extensions, skills, credentials, network access, and
saved sessions. It does not create an isolated profile or disable capabilities.

The conversation starts on `mlx-core/mlx-community/Qwen3.8-27B-4bit`.
A model-only guard stops the session rather than switching its conversation to a
non-MLX provider. Other installed MLX models may be selected. Tool integrations
and explicitly launched subagents retain their normal configuration; this guard
is not a network firewall or a promise that every integration runs locally.

## Use

The extension is listed in `global_extensions` in `config.yml` and linked as
`~/.pi/agent/extensions/private`. Run `/reload` in the parent Pi, then `/private`.
Ask your question in the new window; the launcher does not forward conversation
history or automatically return results to the parent.

**If upgrading from the initial restricted version, close that old private
window and launch a new one.** Reloading it cannot remove its old CLI restrictions.

Contacts can be accessed normally through the shell and the installed
`/opt/homebrew/bin/contactctl`. No separate Contacts wrapper is required.
The global `~/.pi/agent/AGENTS.md` routing rule directs cloud sessions here;
the launcher-supplied instructions identify this as the authorized local session.

Local inference is not an offline sandbox or a no-retention guarantee. Tools
can access networks and local records, credentials are available normally, and
Pi history/terminal scrollback/logs persist. This is the user's requested normal
Pi access with a local conversation model, not a restricted privacy appliance.

## Installation and runtime selection

Requires Ghostty 1.3+, macOS Automation permission, the existing `mlx-core`
extension and its installed Qwen model. No software or models are installed.
The normal agent directory also exposes Pi's cached helper binaries (such as fd),
and the launcher does not force offline mode.

`process.execPath` supplies the running Node executable and `process.argv[1]`
supplies the running Pi entry point. There is no separate Node version pin or
PATH lookup. The current `~/bin/pi` wrapper selects Pi through mise; changing
that wrapper affects newly started parent sessions. Existing sessions retain
their current runtime. Arbitrary wrapper-injected CLI flags are not replayed.
The child inherits its terminal launch environment and receives the parent's
agent-directory path explicitly; variables set only inside the parent process
are not copied into the new Ghostty window.

`cli-path.mjs` resolves npm bin symlinks and verifies the owning package's
`bin.pi`. Both `dist/cli.js` and `dist/bundle/cli.js` are supported. Unsupported
standalone/packaging formats are refused rather than guessed.

## Files

- `index.ts`: slash command and Ghostty window creation.
- `launch.mjs`, `cli-path.mjs`, `policy.mjs`: executable discovery and normal Pi launch.
- `runtime.ts`, `guards.mjs`: local conversation-model guard only.
- `SYSTEM.md`: identifies the local session for personal-data routing.

## Validation

```sh
node --test extensions/private/private.test.mjs
node extensions/private/smoke.mjs "$(mise which pi)"
```

Unit tests cover package layouts, the actual launcher, preserved configuration
and environment, unrestricted launch arguments, and the model guard.
The smoke test runs the actual launcher with normal configuration and asks for
a synthetic shell command only. It verifies local model use, a successful Bash
tool call, and ordinary session persistence in a dedicated synthetic-test session
directory. It never queries Contacts or other personal records.
