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

## Access on this Mac

The home controller uses **fnox profile `unifi`**, backed by local Keychain. Missing old config.toml is expected, not an access blocker.

```sh
UNIFI_HOST=https://unifi UNIFI_ACCEPT_INVALID_CERTS=true mise exec -- \
  fnox exec --config "$HOME/.dotfiles/fnox/config.toml" --profile unifi --no-defaults -- \
  uvx unifi-cli -o json --quiet system health
```

`UNIFI_ACCEPT_INVALID_CERTS=true` is for this known local controller's certificate, not a general recommendation for other hosts.

The GET-only helper also accepts credentials injected by fnox. Resolve its path relative to **this skill directory**, not the caller's cwd:

```sh
UNIFI_HOST=https://unifi mise exec -- \
  fnox exec --config "$HOME/.dotfiles/fnox/config.toml" --profile unifi --no-defaults -- \
  /Users/tom/Development/tkoenig/agent-skills/skills/unifi/tools/unifi-api \
  /proxy/network/api/s/default/stat/device | \
  jq '.data | map({name,model,ip,state})'
```

Do not interpret failure of an old event endpoint as an authentication failure.

## Generic authentication / helpers

For other installations, the CLI supports `UNIFI_HOST`, `UNIFI_API_KEY`, and optional `UNIFI_PROFILE` from the environment or its own config. Do not ask users to paste keys into chat.

- `tools/unifi`: thin wrapper executing `uvx unifi-cli`; lets the CLI load env/config.
- `tools/unifi-api`: GET-only helper loading env/config; `UNIFI_CONFIG` overrides its config path. Its legacy default is `~/Library/Application Support/unifi/config.toml` (old Mac, not current home setup).
- The GET helper accepts invalid TLS certificates and accepts full URLs: for home use, pass only relative API paths and keep the host bound to `https://unifi`. Never forward its credentials to external URLs.
- `config init` is interactive and writes configuration: ask first; do not run merely because a config file is absent.

## CLI output and read-only commands

Current CLI uses **`-o json`**, not the older `--json` flag; add `--quiet` to suppress noise. Examples below require the authentication wrapper above on this Mac.

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

Home site's legacy prefix: `/proxy/network/api/s/default/`.

- `stat/sta`: live clients.
- `rest/user`: persistent client configuration; allowlist name/IP/lock fields.
- `stat/device`: device state, `radio_table_stats` and `vap_table`. Runtime channels can differ from configured `radio_table.channel`.
- `rest/networkconf`: network configuration; allowlist required fields.
- `rest/wlanconf`: WLAN configuration; **contains secrets**, always allowlist.
- `rest/setting`: global settings; **contains secrets**, select exact sections and exact safe fields only.
- AP groups: `/proxy/network/v2/api/site/default/apgroups`; legacy AP-group routes may fail.

Recheck a target AP's live `vap_table` before proposing an AP lock/reconnect; abort if the client's SSID is absent/down.

## Activity history

UniFi has activity logs even when CLI `events list` / legacy `stat/event` return 404. On Network 10.6.106, the verified read-only query is:

- **POST** `/proxy/network/v2/api/site/default/system-log/all`
- JSON body: `{"pageSize":500,"pageNumber":0}`
- Response: `data`, `page_number`, `total_element_count`, `total_page_count`; paginate newest-first.
- This POST only queries logs; it is not a configuration write. Keep any direct query hard-wired to this host/path; no general-purpose write capability is authorized.
- `tools/unifi-api` is GET-only and does **not** implement this query. Use a narrowly scoped authenticated request as documented in the project's `AGENTS.md`.
- Filter events by time/device and allowlist returned parameters before output. `AP_CHANGED_CHANNELS` has previous/new channels; `MADE_CHANGES_*` records configuration edits. Timestamps are Unix milliseconds; display Europe/Vienna for the home network.
- Activity records establish events, not automatically root cause. Historical association duration and API playback state do not establish application functionality.
