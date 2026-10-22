---
name: unifi
description: "Manage and inspect UniFi Network controllers using uvx unifi-cli. Use for clients, network devices, switch ports, networks, activity history, controller health/info, and safe UniFi troubleshooting."
---

# UniFi Network CLI

Use `uvx unifi-cli` for controller inspection and management. Check `--help` / `schema` when commands differ from these examples.

## Home network documentation — read first

- Local project: `/Users/tom/Development/tkoenig/unifi-config/`.
- If unavailable locally, use the GitHub skill / authenticated `gh` to read **private** repo [tkoenig/unifi-config](https://github.com/tkoenig/unifi-config). For example:
  ```sh
  gh api repos/tkoenig/unifi-config/contents/AGENTS.md --jq .content | base64 --decode
  ```
- Read `AGENTS.md` before accessing this controller, then `README.md`, `devices/README.md`, the relevant device notes, and `CHANGELOG.md` as needed. Follow their links for detailed evidence.
- The project holds machine-specific access, device inventories, AP locks, troubleshooting and approved-change history. Do not duplicate that state here or assume historical notes establish current device availability.
- If local checkout is missing and GitHub access fails, report that documentation is unavailable; do not assume credentials/network settings are missing or create a replacement configuration.
- Keep private repo content private; never copy inventories or sensitive logs into public issues.

## Safety

- Read-only by default. Obtain explicit approval before **any mutation**, including client/IP/DNS/port changes, AP locks, RF scans, reconnects, locate actions, restarts, upgrades, credential changes, or `config init`.
- Never print/store credentials, dump fnox environments, or put API keys/passwords in command arguments.
- Filter API responses with explicit field allowlists **before output**. Raw `rest/setting` and `rest/wlanconf` can contain credentials/private keys. Never dump them broadly.
- An AP association is not an AP lock: check persistent `fixed_ap_enabled` and `fixed_ap_mac`; a stored MAC with the flag false is not an enabled lock.
- Avoid interactive `tui` / `top` unless requested.

## Authentication / helpers

Use the target project's documented host, site, credential provider and TLS policy. For the home network, these are authoritative in `unifi-config/AGENTS.md`, not this skill. A missing config file alone does not establish missing credentials; check the documented provider first.

The CLI supports `UNIFI_HOST`, `UNIFI_API_KEY`, and optional `UNIFI_PROFILE` from the environment or its own config. Do not ask users to paste keys into chat.

- `tools/unifi`: thin wrapper executing `uvx unifi-cli`; lets the CLI load env/config.
- `tools/unifi-api`: GET-only helper loading env/config; `UNIFI_CONFIG` overrides its config path. Its default config path is `~/Library/Application Support/unifi/config.toml`; environment credentials can be used instead.
- Resolve helper paths relative to this skill directory, not the caller's cwd.
- The GET helper accepts invalid TLS certificates and full URLs. Use only with a trusted controller under the project's TLS policy; prefer relative API paths and never forward credentials to another host.
- `config init` is interactive and writes configuration: ask first; do not run merely because a config file is absent.

## CLI output and read-only commands

Current CLI uses **`-o json`**, not the older `--json` flag; add `--quiet` to suppress noise. Run examples with the target project's documented authentication wrapper.

```sh
tools/unifi -o json --quiet system health
tools/unifi -o json --quiet system info
tools/unifi -o json --quiet devices list
tools/unifi -o json --quiet devices show <mac>
tools/unifi -o json --quiet devices ports <mac>
tools/unifi -o json --quiet networks
tools/unifi -o json --quiet clients list
tools/unifi -o json --quiet clients list --wireless
tools/unifi -o json --quiet clients show <mac>
```

`clients list` returns **`{items,total,limit,offset}`**, not a bare array. Inspect help for pagination options and retrieve remaining pages when `total` exceeds returned items. Items include Wi-Fi details in current versions; use `clients show` for additional detail.

```sh
tools/unifi -o json --quiet clients list | \
  jq '{total,limit,offset,items:[.items[] | {name,ip,ssid,signal}]}'
```

Use `schema` / subcommand `--help` to discover additional read-only WAN, ports, DNS, port-forward or Protect capabilities. Discovery is not permission to mutate or retrieve sensitive streams/settings.

## Direct GET API

Typical UniFi OS legacy prefix: `/proxy/network/api/s/<site>/`. Use the project's actual host/site; standalone controller routing may differ.

- `stat/sta`: live clients.
- `rest/user`: persistent client configuration; allowlist name/IP/lock fields.
- `stat/device`: device state, `radio_table_stats` and `vap_table`. Runtime channels can differ from configured `radio_table.channel`.
- `rest/networkconf`: network configuration; allowlist required fields.
- `rest/wlanconf`: WLAN configuration; **contains secrets**, always allowlist.
- `rest/setting`: global settings; **contains secrets**, select exact sections and exact safe fields only.
- AP groups: `/proxy/network/v2/api/site/<site>/apgroups`; legacy AP-group routes may fail.

Recheck a target AP's live `vap_table` before proposing an AP lock/reconnect; abort if the client's SSID is absent/down.

## Activity history

UniFi can have activity logs even when CLI `events list` / legacy `stat/event` return 404. This is not necessarily an authentication failure. Recent versions can expose the following read-only query; verify support and permission in the target project's instructions:

- **POST** `/proxy/network/v2/api/site/<site>/system-log/all`
- JSON body: `{"pageSize":500,"pageNumber":0}`
- Response: `data`, `page_number`, `total_element_count`, `total_page_count`; paginate newest-first.
- This POST queries logs, not configuration. Restrict any implementation to the approved controller and exact log-query path; this does not authorize other POST operations.
- `tools/unifi-api` is GET-only and does **not** implement this query. Use a narrowly scoped authenticated request as documented in the project's `AGENTS.md`.
- Filter events by time/device and allowlist returned parameters before output. `AP_CHANGED_CHANNELS` has previous/new channels; `MADE_CHANGES_*` records configuration edits. Timestamps are Unix milliseconds; use the project's documented timezone.
- Activity records establish events, not automatically root cause. Historical association duration and API playback state do not establish application functionality.
