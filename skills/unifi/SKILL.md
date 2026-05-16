---
name: unifi
description: "Manage and inspect UniFi Network controllers using uvx unifi-cli. Use for clients, network devices, switch ports, networks, events, controller health/info, and safe UniFi troubleshooting."
---

# UniFi Network CLI

Use `uvx unifi-cli` for UniFi Network controller inspection and management.

## Safety

- Prefer read-only commands for routine work: `list`, `show`, `ports`, `networks`, `events`, `system`.
- Ask explicit user confirmation before mutating commands:
  - `clients set-fixed-ip`, `clients block`, `clients unblock`, `clients kick`
  - `devices restart`, `devices locate`, `devices upgrade`
  - `config init`
- Never print or store `UNIFI_API_KEY`.
- Avoid interactive TUI commands (`tui` / `top`) unless the user asks; they are not useful in non-interactive agent runs.

## Setup

Run via uvx; no install required:

```bash
uvx unifi-cli --help
```

Authentication options:

```bash
export UNIFI_HOST="https://<controller-host>"
export UNIFI_API_KEY="<api-key>"
export UNIFI_PROFILE="<profile>"   # optional
```

Or pass flags:

```bash
uvx unifi-cli --host "$UNIFI_HOST" --api-key "$UNIFI_API_KEY" <command>
```

Config file workflow:

```bash
uvx unifi-cli config init    # interactive; ask first
tools/unifi config check
```

Project/local config may live at `~/Library/Application Support/unifi/config.toml` with top-level `host` and `api_key`. `uvx unifi-cli` loads this config itself. Prefer the enclosed helper scripts for concise skill-local commands and direct API calls without printing or temp-writing the API key:

```bash
# Resolve relative to this skill directory.
tools/unifi --json --quiet system health
tools/unifi --json --quiet clients list
```

Helpers:

- `tools/unifi` — thin skill-local wrapper; execs `uvx unifi-cli` and lets it load its own config/env.
- `tools/unifi-api` — GET-only direct API helper; loads the same config/env for endpoints not covered by the CLI.

For `tools/unifi-api`, override config path with `UNIFI_CONFIG=/path/to/config.toml`.

## Output

- Use `--json` for parsing; it is auto-enabled when stdout is not a TTY, but pass it explicitly for clarity.
- Use `--quiet` to suppress summary/confirmation noise.
- Pipe to `jq` for concise summaries.

```bash
tools/unifi --json --quiet system health | jq .
```

Exit codes:

| Code | Meaning |
|---:|---|
| 0 | success |
| 1 | general error |
| 2 | configuration error / missing host or API key |
| 3 | authentication error (401/403) |
| 4 | not found (404) |
| 5 | API/server error |

## Read-Only Commands

System health/info:

```bash
tools/unifi --json system health
tools/unifi --json system info
```

Networks:

```bash
tools/unifi --json networks
```

Recent events:

```bash
tools/unifi --json events list --limit 25
```

Clients:

```bash
tools/unifi --json clients list
tools/unifi --json clients list --wired
tools/unifi --json clients list --wireless
tools/unifi --json clients list --name "printer"
tools/unifi --json clients show <mac>
tools/unifi --json clients top --limit 10
```

Devices:

```bash
tools/unifi --json devices list
tools/unifi --json devices show <mac>
tools/unifi --json devices ports <mac>
```

Useful summaries:

```bash
tools/unifi --json clients list | jq -r '.[] | [.name,.ip,.mac,.type] | @tsv'
tools/unifi --json devices list | jq -r '.[] | [.name,.model,.ip,.state,.firmware] | @tsv'
tools/unifi --json devices ports <mac> | jq -r '.[] | [.port_idx,.name,.up,.speed,.poe_enable,.poe_power] | @tsv'
```

`clients list` output is minimal; use `clients show <mac>` for Wi-Fi details (`signal`, `ap_mac`, `ssid`, `uptime`). To rank wireless clients by RSSI:

```bash
tools/unifi --json --quiet clients list --wireless | jq -r '.[].mac' | \
  while read mac; do tools/unifi --json --quiet clients show "$mac" | \
  jq -r '[.name,.ip,.mac,.signal,.ap_mac,.ssid] | @tsv'; done | sort -k4n
```

If `events list` returns 404 on newer controllers, use direct UniFi API endpoints for details, e.g. WLAN/AP radio config and client stats:

```bash
tools/unifi-api /proxy/network/api/s/default/rest/wlanconf
tools/unifi-api /proxy/network/api/s/default/stat/device
tools/unifi-api /proxy/network/api/s/default/stat/sta
```

## Mutating Commands — Ask First

Client actions:

```bash
tools/unifi clients set-fixed-ip <mac> <ip> --name "<friendly-name>"
tools/unifi clients block <mac>
tools/unifi clients unblock <mac>
tools/unifi clients kick <mac>
```

Device actions:

```bash
tools/unifi devices locate <mac>
tools/unifi devices locate <mac> --off
tools/unifi devices restart <mac>
tools/unifi devices upgrade <mac>
```

## Introspection

Dump command schema when CLI behavior changes:

```bash
tools/unifi schema
```

Main commands from schema/help:

- `clients list|show|top|set-fixed-ip|block|unblock|kick`
- `devices list|show|ports|locate|restart|upgrade`
- `networks`
- `events list`
- `system health|info`
- `config init|check`
- `tui` / `top`
- `completions <bash|zsh|fish|powershell>`
