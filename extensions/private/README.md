# `/private`

A shortcut in the **current Pi window**:

1. Create a fresh session, without copying conversation history.
2. Select `mlx-core/mlx-community/Qwen3.8-27B-4bit`.
3. Name the session `Private`.

Everything else stays normal: tools, shell, extensions, configuration, and saved
history. No window launcher, isolated profile, extra system prompt, status label,
or model lock. This is a convenience command, not a privacy sandbox. Start a
fresh session before switching personal local-model work to a cloud model.

Enabled through `config.yml` and `~/.pi/agent/extensions/private`. Requires the
existing `mlx-core` extension and installed Qwen model. Run `/reload`, then
`/private`. Use `/resume` to return to another session.

If you still have an old launcher-created Pi window, close it and use the command
from a normally started Pi session: that old process may retain removed CLI flags.

Implementation: `index.ts`. Pi invalidates the command API on session replacement,
so an internal `--finish` command runs model/name selection on the new runtime.
It is dispatched as a command, never as a model prompt. You only use `/private`.

## Tests

```sh
node --test extensions/private/private.test.mjs
node extensions/private/smoke.mjs "$(mise which pi)"
```

The RPC smoke test uses a temporary configuration, verifies a new session ID,
name and local model, and confirms that no conversation messages or model
requests were generated. No Contacts or other personal records are accessed.
