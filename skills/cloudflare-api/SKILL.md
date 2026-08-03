---
name: cloudflare-api
description: Connect to Cloudflare API via Cloudflare MCP Code Mode or local scripts for DNS management, R2 bucket management, tunnels, and zone administration. Use when user needs to manage domains, DNS records, R2 buckets, Workers, D1, rulesets, or Cloudflare API operations.
read_when:
  - User asks about Cloudflare DNS or domains
  - User wants to create or manage DNS records
  - User needs to set up Cloudflare tunnels
  - User wants to list their Cloudflare zones
  - User asks about R2 buckets or object storage
metadata:
  clawdbot:
    emoji: "☁️"
    requires:
      bins: ["curl", "jq", "npx"]
---

# Cloudflare Skill

> **Origin:** Forked from [lucassynnott/cloudflare-api](https://github.com/openclaw/skills/tree/main/skills/lucassynnott/cloudflare-api) on OpenClaw.

Connect to [Cloudflare](https://cloudflare.com) API for DNS management, tunnels, and zone administration.

## Tool Routing

Prefer Cloudflare MCP Code Mode for broad or unknown Cloudflare API work. Use the local scripts for known, deterministic DNS/R2/tunnel workflows that this skill already covers.

| Task | Preferred path |
| --- | --- |
| Cloudflare product/API discovery | Native MCP `cloudflare_docs` then `cloudflare_search` (fallback: `./scripts/mcp.sh docs` / `search`) |
| Unknown endpoint, Workers, D1, Rulesets, WAF, Pages, AI Gateway, etc. | Native MCP `cloudflare_search` → `cloudflare_execute` |
| Exact DNS CRUD from this skill | Local DNS scripts |
| Common R2 bucket workflows, especially jurisdiction-sensitive checks | Local R2 scripts |
| Tunnel CRUD from this skill | Local tunnel scripts |
| Analytics / GraphQL reporting | `cloudflare-analytics` skill first; MCP fallback |
| MCP unavailable or unauthenticated | Local scripts + Cloudflare `llms.txt` fallback |

For MCP `execute`, read-only API calls are okay. Ask the user before `POST`, `PUT`, `PATCH`, or `DELETE`, especially for DNS records, R2 buckets, tunnels, rulesets, WAF, Workers, and access/security settings.

## Cloudflare MCP (preferred: pi-mcp-adapter)

The server is configured globally in `~/.config/mcp/mcp.json` as `cloudflare` (`https://mcp.cloudflare.com/mcp`, OAuth handled by the adapter). Call tools through the `mcp` proxy tool; `args` is a JSON **string**:

```
mcp({ search: "cloudflare" })                       # discover tools/schemas
mcp({ tool: "cloudflare_docs", args: "{\"query\":\"R2 bucket jurisdiction API\"}" })
mcp({ tool: "cloudflare_search", args: "{\"code\":\"async () => Object.keys(spec.paths).filter(p => p.includes('/workers/scripts'))\"}" })
mcp({ tool: "cloudflare_execute", args: "{\"code\":\"async () => { const r = await cloudflare.request({ method: 'GET', path: `/accounts/${accountId}/workers/scripts` }); return r.result; }\"}" })
```

If a call fails with "Re-authentication required", start OAuth and give the user the returned URL:

```
mcp({ action: "auth-start", server: "cloudflare" })
```

The browser redirects to a localhost URL that fails to load; the user copies the full URL and you complete with `mcp({ action: "auth-complete", server: "cloudflare", args: "{\"redirectUrl\":\"...\"}" })`.

## Cloudflare MCP via mcporter (fallback)

Use only when the native adapter is unavailable. The helper script wraps `npx --yes mcporter@latest` so the skill uses the latest MCPorter transport/OAuth support.

```bash
./scripts/mcp.sh install   # add https://mcp.cloudflare.com/mcp to MCPorter as cloudflare-api
./scripts/mcp.sh auth      # OAuth login/refresh
./scripts/mcp.sh status    # verify auth/connection without printing secrets
./scripts/mcp.sh list      # list available MCP tools
```

Useful MCP calls:

```bash
./scripts/mcp.sh docs "R2 bucket jurisdiction API"
./scripts/mcp.sh search 'async () => Object.keys(spec.paths).filter(p => p.includes("/workers/scripts"))'
./scripts/mcp.sh execute 'async () => { const r = await cloudflare.request({ method: "GET", path: `/accounts/${accountId}/workers/scripts` }); return r.result; }'
```

Use `CLOUDFLARE_MCP_SERVER` when the MCPorter server name is not `cloudflare-api`.

## Cloudflare API Reference Fallback

For full API documentation when MCP is unavailable, fetch the LLM-optimized reference:

```bash
curl -s https://developers.cloudflare.com/llms.txt
```

Use product-specific `llms.txt` files from that index when possible.

## Direct API Script Setup

### 1. Get Your API Token
1. Go to [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Create a token with required permissions:
   - **Zone:Read** - List domains
   - **DNS:Edit** - Manage DNS records
   - **Account:Cloudflare Tunnel:Edit** - Manage tunnels
3. Copy the token

### 2. Configure
```bash
# Option A: Store in file (recommended)
echo "YOUR_API_TOKEN" > ~/.cloudflare_token
chmod 600 ~/.cloudflare_token

# Option B: Environment variable
export CLOUDFLARE_API_TOKEN="YOUR_API_TOKEN"
```

### 3. Test Connection
```bash
./scripts/setup.sh
```

---

## Commands

### Zones (Domains)

```bash
./scripts/zones/list.sh                    # List all zones
./scripts/zones/list.sh --json             # JSON output
./scripts/zones/get.sh example.com         # Get zone details
```

### DNS Records

```bash
# List records
./scripts/dns/list.sh example.com
./scripts/dns/list.sh example.com --type A
./scripts/dns/list.sh example.com --name api

# Create record
./scripts/dns/create.sh example.com \
  --type A \
  --name api \
  --content 1.2.3.4 \
  --proxied

# Create CNAME
./scripts/dns/create.sh example.com \
  --type CNAME \
  --name www \
  --content example.com \
  --proxied

# Update record
./scripts/dns/update.sh example.com \
  --name api \
  --type A \
  --content 5.6.7.8

# Delete record
./scripts/dns/delete.sh example.com --name api --type A
```

### Tunnels

```bash
# List tunnels
./scripts/tunnels/list.sh

# Create tunnel
./scripts/tunnels/create.sh my-tunnel

# Configure tunnel ingress
./scripts/tunnels/configure.sh my-tunnel \
  --hostname app.example.com \
  --service http://localhost:3000

# Get run token
./scripts/tunnels/token.sh my-tunnel

# Delete tunnel
./scripts/tunnels/delete.sh my-tunnel
```

### R2 Buckets

```bash
# List buckets (defaults to EU jurisdiction)
./scripts/r2/list.sh
./scripts/r2/list.sh --json

# Get bucket details
./scripts/r2/get.sh my-bucket

# Create bucket (defaults to EU jurisdiction for GDPR compliance)
./scripts/r2/create.sh my-bucket
./scripts/r2/create.sh my-bucket --location weur
./scripts/r2/create.sh my-bucket --storage-class InfrequentAccess

# Create bucket without jurisdiction (global)
./scripts/r2/create.sh my-bucket --no-jurisdiction

# Override jurisdiction
./scripts/r2/create.sh my-bucket --jurisdiction eu

# Delete bucket (must be empty)
./scripts/r2/delete.sh my-bucket
```

> **⚠️ Jurisdiction is critical:** All R2 commands default to `--jurisdiction eu` for GDPR compliance. The Cloudflare API **completely hides** buckets in other jurisdictions — EU-jurisdiction buckets are invisible without the `cf-r2-jurisdiction: eu` header, and vice versa. If a bucket seems to be missing, check you're using the right jurisdiction. Use `--no-jurisdiction` to interact with global/default-jurisdiction buckets.

---

## Token Permissions

| Feature | Required Permission |
|---------|-------------------|
| List zones | Zone:Read |
| Manage DNS | DNS:Edit |
| Manage tunnels | Account:Cloudflare Tunnel:Edit |
| Manage R2 buckets | Workers R2 Storage:Write |

Create token at: [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)

---

## Common Workflows

### Point subdomain to server
```bash
./scripts/dns/create.sh mysite.com --type A --name api --content 1.2.3.4 --proxied
```

### Set up tunnel for local service
```bash
# 1. Create tunnel
./scripts/tunnels/create.sh webhook-tunnel

# 2. Configure ingress
./scripts/tunnels/configure.sh webhook-tunnel \
  --hostname hook.mysite.com \
  --service http://localhost:8080

# 3. Add DNS record
TUNNEL_ID=$(./scripts/tunnels/list.sh --name webhook-tunnel --quiet)
./scripts/dns/create.sh mysite.com \
  --type CNAME \
  --name hook \
  --content ${TUNNEL_ID}.cfargotunnel.com \
  --proxied

# 4. Run tunnel
TOKEN=$(./scripts/tunnels/token.sh webhook-tunnel)
cloudflared tunnel run --token $TOKEN
```

### Create an R2 bucket in a specific region
```bash
# Create bucket in Western Europe
./scripts/r2/create.sh my-assets --location weur

# Verify
./scripts/r2/get.sh my-assets
```

---

## Output Formats

| Flag | Description |
|------|-------------|
| `--json` | Raw JSON from API |
| `--table` | Formatted table (default) |
| `--quiet` | Minimal output (IDs only) |

---

## Troubleshooting

| Error | Solution |
|-------|----------|
| "No API token found" | Run setup or set CLOUDFLARE_API_TOKEN |
| "401 Unauthorized" | Check token is valid |
| "403 Forbidden" | Token missing required permission |
| "Zone not found" | Verify domain is in your account |
