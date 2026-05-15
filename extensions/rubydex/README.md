# Rubydex MCP Extension

Pi tools for Shopify Rubydex via MCPorter.

This extension does **not** bundle Rubydex. It is a thin adapter:

```txt
pi tool → this extension → MCPorter → rubydex_mcp → Rubydex engine
```

## What it adds

- `rubydex_stats` — index statistics
- `rubydex_search` — semantic Ruby declaration search
- `rubydex_declaration` — full declaration details by fully qualified name
- `rubydex_descendants` — descendants for a class/module
- `rubydex_constant_references` — resolved constant references
- `rubydex_file_declarations` — declarations defined in a Ruby file

## Requirements

- pi coding agent
- Node/npm, for `npx mcporter`
- MCPorter, either via `npx -y mcporter` or an installed binary
- Rust toolchain `1.89.0` or newer to build `rubydex_mcp`
- Shopify Rubydex MCP binary installed at `~/.cargo/bin/rubydex_mcp`
- MCPorter config with a server named `rubydex`

The `rubydex` Ruby gem is **not** required for this extension. The extension uses the Rust MCP server.

## Important caveats

- Users currently need to build `rubydex_mcp` manually from Shopify's repository.
- The extension requires MCPorter to resolve a configured MCP server named `rubydex` by default. Without that `config/mcporter.json` or user-level MCPorter config, the pi tools will fail.
- By default, the extension runs `npx -y mcporter`, which may download/use the latest MCPorter. Set `MCPORTER_BIN` to use a pinned/local MCPorter binary.
- The extension shells out to MCPorter through `pi.exec`; it is not a native MCP client.
- Rubydex MCP is experimental upstream.
- Project `config/mcporter.json` often contains local paths. Prefer user-level MCPorter config if you do not want project repos to contain machine-specific MCP setup.

## Install `rubydex_mcp`

Do **not** install `rubydex-mcp` from crates.io; as of this writing the crates.io package name is a placeholder. Build from Shopify's repository instead.

```sh
rustup toolchain install 1.89.0

git clone --depth 1 --branch v0.2.3 https://github.com/Shopify/rubydex.git /tmp/rubydex-src
cd /tmp/rubydex-src/rust

TOOLCHAIN_DIR="$(rustup run 1.89.0 rustc --print sysroot)"
RUSTC="$TOOLCHAIN_DIR/bin/rustc" "$TOOLCHAIN_DIR/bin/cargo" install --path rubydex-mcp --locked
```

If your `cargo` command comes from rustup shims, this shorter form may also work:

```sh
cargo +1.89.0 install --path rubydex-mcp --locked
```

Verify:

```sh
~/.cargo/bin/rubydex_mcp --version
```

Expected shape:

```txt
rubydex_mcp 0.1.0
```

## Configure MCPorter

### Recommended default: user-level config

For agents setting this up in a project, use **user-level MCPorter config by default**. It avoids adding machine-specific paths to the app repo.

From the Ruby project root:

```sh
npx -y mcporter config add rubydex \
  --command "$HOME/.cargo/bin/rubydex_mcp" \
  --arg "$PWD" \
  --description "Rubydex MCP semantic Ruby code intelligence" \
  --scope home
```

Use this unless the user explicitly asks for project-local MCP config.

### Optional: project-local config

Use project-local config only when the project intentionally wants MCP setup in the repo.

From the Ruby project root:

```sh
npx -y mcporter config add rubydex \
  --command "$HOME/.cargo/bin/rubydex_mcp" \
  --arg "$PWD" \
  --description "Rubydex MCP semantic Ruby code intelligence" \
  --scope project
```

Then edit `config/mcporter.json` and add keep-alive if desired:

```json
{
  "mcpServers": {
    "rubydex": {
      "command": "${HOME}/.cargo/bin/rubydex_mcp",
      "args": ["/path/to/ruby/project"],
      "description": "Rubydex MCP semantic Ruby code intelligence",
      "lifecycle": "keep-alive"
    }
  }
}
```

## Verify MCPorter

```sh
npx -y mcporter config doctor
npx -y mcporter list rubydex --schema
npx -y mcporter call rubydex.codebase_stats
```

If `codebase_stats` says Rubydex is still indexing, retry after a few seconds.

Optional daemon prewarm:

```sh
npx -y mcporter daemon restart
npx -y mcporter daemon status
```

## Activate the pi extension

### Project-local activation

From the Ruby project root:

```sh
mkdir -p .pi/extensions
ln -sfn /path/to/agent-skills/extensions/rubydex .pi/extensions/rubydex
```

Then restart pi or run:

```txt
/reload
```

### Global activation

```sh
mkdir -p ~/.pi/agent/extensions
ln -sfn /path/to/agent-skills/extensions/rubydex ~/.pi/agent/extensions/rubydex
```

Then restart pi or run `/reload`.

## Verify in pi

Ask pi to use one of the tools, or run a quick startup check:

```sh
pi --no-extensions -e /path/to/agent-skills/extensions/rubydex --offline --list-models nonexistent-model-filter
```

Inside pi, direct tool calls should be available to the agent:

- `rubydex_stats`
- `rubydex_search`
- `rubydex_declaration`
- `rubydex_descendants`
- `rubydex_constant_references`
- `rubydex_file_declarations`

## Configuration

Environment variables:

- `MCPORTER_BIN` — use a specific MCPorter binary instead of `npx -y mcporter`
- `RUBYDEX_MCP_SERVER` — MCPorter server name, default `rubydex`

## Agent setup guidance

When an agent is asked to set this up for a Ruby project:

1. Build/install `rubydex_mcp` if `~/.cargo/bin/rubydex_mcp --version` fails.
2. Add MCPorter config with `--scope home` from the target project root, unless the user explicitly asks to commit project-local MCP config.
3. Link this extension into `.pi/extensions/rubydex` for project-local activation, or `~/.pi/agent/extensions/rubydex` for global activation.
4. Verify with `npx -y mcporter call rubydex.codebase_stats`.
5. Ask the user to run `/reload` in any already-running pi session.

## Notes

- The first Rubydex call after daemon restart can return `Rubydex is still indexing`; the extension retries a few times automatically.
- Tool output is truncated at pi's default `2000` lines / `50KB` limit.
- By default, the extension runs `npx -y mcporter`, which may download/use the latest MCPorter. Install MCPorter locally and set `MCPORTER_BIN` if you want a pinned binary.
- The extension shells out to MCPorter through `pi.exec`; it does not speak MCP directly.
- Project `config/mcporter.json` may include local paths. Prefer user-level MCPorter config if sharing an app repo with teammates who may not use the same path.
