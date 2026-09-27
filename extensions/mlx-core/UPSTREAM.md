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
  delegated Pi API streaming, and `session_shutdown` integration.

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
7. Initial scope: existing Qwen 3.5-family MLX artifacts (including Qwen 3.8),
   text and tools, no downloads/builds/upgrades, no vision. Inference protocol is
   OpenAI Chat Completions via Pi's implementation, not copied HTTP code.

## Upstream references

- https://github.com/mitsuhiko/pi-ds4/blob/db8806cd52757fbaf957fe56b54700a1094a30b8/index.ts
- https://github.com/mitsuhiko/pi-ds4/blob/db8806cd52757fbaf957fe56b54700a1094a30b8/ds4-watchdog.sh
- mlx-serve CLI contract: https://github.com/ddalcu/mlx-serve/blob/v26.9.1/docs/cli.md
