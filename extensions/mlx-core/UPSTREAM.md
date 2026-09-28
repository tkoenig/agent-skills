# Upstream provenance

Lifecycle design and substantial code are adapted from **Armin Ronacher's
[mitsuhiko/pi-ds4](https://github.com/mitsuhiko/pi-ds4)** at:

`db8806cd52757fbaf957fe56b54700a1094a30b8`

The MIT license and Armin's copyright notice are preserved in `LICENSE`.

## Mapping

- `lifecycle.ts`: `index.ts` process identity helpers, mkdir/owner lifecycle
  lock, atomic JSON state, per-PID client leases, 10-second heartbeat,
  45-second stale-lease threshold, random loopback port allocation, detached
  logged server/watchdog spawn, readiness loop, shared startup promise, and
  lease-based shutdown.
- `mlx-watchdog.sh`: adapted directly from `ds4-watchdog.sh`. Retains process
  start-time checks, lease pruning, established-client check, graceful TERM,
  60-second grace, KILL fallback, and shutdown after the last lease.
- `index.ts`: native `createProvider` + `lazyStream`, filesystem model catalog,
  delegated Pi API streaming, `before_agent_start`/`agent_settled` working-message
  restoration (at first content/tool/thinking event, error, abort or shutdown),
  and `session_shutdown` integration. Status callbacks for shared startup are
  per caller; an aborted caller cannot repaint a newer request.
- `log-viewer.ts`: adapted bounded tail (256 KiB/2,000 lines), one-second poll,
  scrolling/following and overlay lifecycle from Armin's `Ds4LogViewer`; two
  local MLX logs are selectable. Non-TUI modes display paths only.

This is an adaptation, not a byte-for-byte vendor copy. Keep future changes
narrow and compare lifecycle fixes against upstream before inventing alternatives.

## Intentional differences

1. State lives under `~/.pi/mlx-core`, never `~/.pi/ds4` or MLX Core app state.
   Server arguments are mlx-serve's, with an explicit loopback bind, no LAN
   flags, one resident model, and a bounded context. The app-owned server is
   never adopted or stopped; there is no fallback to a process found by port.
2. The server discovers its shared local model directory and can switch models
   itself. No per-model server restart or shared reserved-port file is needed:
   the lifecycle lock serializes allocation/spawn, and streams use the endpoint
   from the verified server state. No network activity in the extension factory.
3. The watchdog takes the same lifecycle lock while checking leases and stopping
   the server, preventing a new client acquiring a lease between those steps.
   Its identity is recorded; it removes that record under the lock on exit.
   A live lock owner is not evicted merely because the lock is old.
4. Server identity checks fail closed when process start time is missing.
   The watchdog rechecks identity before KILL. It never finds/adopts a server
   from a listening port. Configuration conflicts fail rather than restarting
   a server another session might be using.
5. `/mlx stop` releases only this session's lease; it cannot force-stop others.
   Cancellation of one request does not cancel shared startup.
6. Runtime metadata/locks are moved to macOS Trash, per this machine's policy,
   rather than permanently deleted. This makes the implementation macOS-only.
7. Catalog uses a conservative subset of mlx-serve v26.9.6's
   `src/model_discovery.zig` `supported_model_types`: Qwen 3/3.5 text,
   Llama, Mistral and Gemma 3 text, requiring weights and a chat template.
   Reasoning is advertised only for Qwen templates declaring thinking;
   vision, embeddings and media are excluded. This is not a guarantee that
   every supported architecture/checkpoint works. Inference remains Pi's
   OpenAI Chat Completions implementation, not copied HTTP code.
8. Readiness is only `/models` HTTP health plus managed process identity;
   it does not establish that weights loaded. The spinner says server starting
   until HTTP-ready, then waits for a model response, never inferring model
   load state from `/models`. `/mlx status` checks both identity and health
   without adopting an app-owned server.

## Upstream references

- https://github.com/mitsuhiko/pi-ds4/blob/db8806cd52757fbaf957fe56b54700a1094a30b8/index.ts
- https://github.com/mitsuhiko/pi-ds4/blob/db8806cd52757fbaf957fe56b54700a1094a30b8/ds4-watchdog.sh
- mlx-serve v26.9.6 architecture discovery: https://github.com/ddalcu/mlx-serve/blob/v26.9.6/src/model_discovery.zig
- mlx-serve CLI contract: https://github.com/ddalcu/mlx-serve/blob/v26.9.6/docs/cli.md
