---
name: cloudflare-api
description: Connect to Cloudflare API for DNS management, R2 bucket management, tunnels, and zone administration. Use when user needs to manage domains, DNS records, R2 buckets, or create tunnels.
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
      bins: ["curl", "jq"]
---

# Cloudflare Skill

> **Origin:** Forked from [lucassynnott/cloudflare-api](https://github.com/openclaw/skills/tree/main/skills/lucassynnott/cloudflare-api) on OpenClaw.

Connect to [Cloudflare](https://cloudflare.com) API for DNS management, tunnels, and zone administration.

## Cloudflare API Reference

For full API documentation, fetch the LLM-optimized reference:

```bash
curl -s https://developers.cloudflare.com/llms.txt
```

Use this when you need to look up endpoints, parameters, or capabilities beyond what this skill covers.

## Setup

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
