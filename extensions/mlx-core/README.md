# MLX Core provider for Pi

Local `mlx-serve` lifecycle integration, adapted from **Armin Ronacher's
[pi-ds4](https://github.com/mitsuhiko/pi-ds4)**. See [UPSTREAM.md](UPSTREAM.md)
for the exact revision, reused components, and intentional differences.

## Requirements

- macOS / Apple Silicon, `/usr/bin/trash`, Node 22.18+ for tests.
- MLX Core / `mlx-serve` already installed (26.9.6 recommended and tested for thinking-budget enforcement; app renamed MLX-Serve in 26.9.6).
- Pi 0.87.1 (`@earendil-works` packages).
- A completed supported chat MLX download in `~/.mlx-serve/models`.
  Qwen3.8-27B uses the Qwen 3.5 architecture and is the tested target.

No runtime/model downloads, upgrades, or MLX Core app settings are changed by
this extension. Inference stays local; `/mlx updates` explicitly contacts GitHub
for public release metadata only (no credentials, prompts, or model data). Weights are shared with MLX Core, not copied.

## Try without enabling globally

```sh
pi -e /absolute/path/to/agent-skills/extensions/mlx-core/index.ts
```

Select `mlx-core/mlx-community/Qwen3.8-27B-4bit` with `/model`, then send a
message. The first request starts a separate managed server on a random
`127.0.0.1` port. Models load on demand. Merely listing models does not start
any process or download anything. Startup shows an elapsed server-readiness
working message, then waits for the first model response; HTTP readiness does
not imply model weights have loaded.

For permanent activation, explicitly add `mlx-core` to `global_extensions` in
this repository's `config.yml` and link the extension through the normal
skill-manager workflow. Do not register it twice as both a package and a symlink.

## Commands

- `/mlx` — action menu (or status without a UI)
- `/mlx status` — local catalog count and identity-checked, HTTP-healthy server state (no startup)
- `/mlx start` — start/reuse the managed server
- `/mlx stop` — release **this Pi process's** lease; never force-stop another user
- `/mlx refresh` — rediscover completed local models
- `/mlx logs` — bounded, scrolling local lifecycle/server log viewer in the TUI;
  paths only outside TUI. Logs are never inserted into model context automatically.
- `/mlx updates` — compare the installed CLI version with GitHub's latest stable
  release. Manual only, no background checks or automatic upgrades. Respects
  `PI_OFFLINE=1`; shows the CLI version, not the separate app bundle version.

The server remains available while any Pi process holds a live lease, not just
while tokens stream. Quit Pi or use `/mlx stop` to release it. The watchdog stops
the server after the last lease disappears and existing connections close.
Crashes are detected through PID/start-time checks and expiring heartbeats.
`/reload` and session replacement retain a short lease for handoff; it expires
if the new instance does not use MLX. Configuration mismatches fail rather than
restarting another process's server. If models are added while the server is
running and aren't advertised yet, release all users and start it again.

## Settings (optional)

`~/.pi/mlx-core/settings.json`:

```json
{
  "binary": "/opt/homebrew/bin/mlx-serve",
  "modelDir": "/Users/YOU/.mlx-serve/models",
  "contextTokens": 65536,
  "maxTokens": 32768,
  "answerReserveTokens": 8192,
  "readyTimeoutMs": 120000
}
```

Omit the file to use defaults: 65,536-token context, 32,768-token output cap
(thinking and answer combined), and up to 8,192 tokens reserved for the answer.
High/xhigh thinking receives the remaining budget (24,576 tokens at defaults),
while low/medium keep their 2,048/8,192 budgets. The server's explicit
`reasoning_budget_tokens` closes the thinking block at the cap; it does not merely
hide reasoning. Smaller per-request output caps scale the answer reserve down
to at most a quarter of that cap. Long answers can still hit the output limit.

Pi receives these same model limits: its footer shows approximately `66k` context,
and `pi --list-models mlx-core` shows context and max output. Output is also capped
at half a model's supported context. For larger coding sessions, e.g. set context
to 131072 and output to 65536; allow extra RAM and latency. After changing context,
release MLX in all Pi users (`/mlx stop` or quit), then `/reload` and reselect the
model. A live server with old context settings is deliberately not force-restarted.

`PI_MLX_CORE_DIR` isolates lifecycle/config state
for tests. Binary and model-directory paths must be absolute. Context is bounded
by both this cap and the model configuration. Supported catalog is a conservative subset of mlx-serve v26.9.6 chat
architectures: Qwen 3/3.5 (including 3.8 variants with Qwen 3.5 config),
Llama, Mistral, Gemma 3 text. A complete weight set and chat template are
required; embeddings, media and unsupported types are not advertised.
Reasoning is advertised only when a Qwen chat template declares thinking.
Other architectures are source-supported but not all checkpoints are live-tested;
models may still be rejected at runtime. Scope is text/tools, with at most one
resident model and vision disabled. Memory still depends on context
and the chosen model. Avoid loading the same large model in MLX Core and Pi
simultaneously: their independent servers have independent RAM allocations.

## Privacy and ownership

- Always explicitly binds `127.0.0.1`; no configurable remote base URL.
- Never enables `--lan-discover`/`--lan-share`, and rejects `@peer` model IDs.
- Never adopts or kills app-owned servers. Only a recorded, identity-checked
  process started by this extension can be stopped.
- Uses Pi's built-in OpenAI Chat Completions implementation; no bespoke wire
  protocol, tool parser, or prompt logger. Dummy local authentication only.
- Lifecycle data stays under `~/.pi/mlx-core`; no changes to `auth.json`.
- Minimal server logging, no disk prefix-cache option. This is **not a sandbox
  or a no-retention guarantee**: Pi/subagent transcripts and backend diagnostics
  can persist sensitive text. Privacy-auditor redaction is instruction-level,
  not enforced; a synthetic fixture retry must be reviewed before relying on
  its output, and reference syntax is not proof of secret-manager integration.
  Use a fresh local-only session and don't later send that history to a cloud provider.
- Localhost is not per-user authentication: other processes on this Mac may
  reach the endpoint. Treat the local machine as trusted.
- Runtime metadata cleanup goes to macOS Trash, including lock directories,
  following this machine's deletion policy.

## Development and validation

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
# Opt-in real inference; synthetic prompts only, no personal files or credentials:
PI_MLX_CORE_DIR="$HOME/.pi/mlx-core-smoke" node test/live-smoke.ts
```

Automated lifecycle tests use two independent child processes and a fake HTTP
server: shared startup, one-client exit, crashed-client cleanup, stale lock/state,
foreign-server preservation, configuration conflict, spawn failure, readiness
timeout, stale/unhealthy status, and pre-start cancellation.
Catalog tests reject incomplete downloads, remote IDs, and non-chat architectures.
Live smoke checks streaming text/Unicode/usage, parsed tool calls and tool-result
round trips, high-thinking coding completion with answer space reserved, and
in-flight cancellation. It uses Pi's provider implementation
but does not launch an agent or read user credential/config files.

Not yet covered: vision (disabled), exhaustive backend error/context-overflow
handling, large-context performance, other architecture live inference, hostile local users,
and runtime changes beyond the tested mlx-serve releases.

For a Homebrew-managed installation, quit active users before upgrading the CLI
and app with `brew upgrade --formula ddalcu/mlx-serve/mlx-serve` and
`brew upgrade --cask ddalcu/mlx-serve/mlx-core`. The cask token remains `mlx-core`
even though the app is now called MLX-Serve. Restart the managed server after an
upgrade so it runs the new binary.
