---
name: hcloud
description: "Manage Hetzner Cloud infrastructure using the hcloud CLI. List servers, server types, volumes, networks, firewalls, and more. Use for checking server status, available instance types, and infrastructure management."
---

# Hetzner Cloud CLI

Manage Hetzner Cloud resources via the `hcloud` CLI.

## ⚠️ Security: Use Read-Only Tokens for LLM Usage

**IMPORTANT**: When using hcloud with an AI/LLM agent, always use a **read-only API token**. This prevents accidental destructive operations like server deletion, reboots, or configuration changes.

Create a read-only token in Hetzner Cloud Console → Security → API Tokens → Generate API Token → Select "Read" permissions only.

## Setup

Install hcloud CLI:
```bash
brew install hcloud
```

Create a context with your API token:
```bash
hcloud context create <name> --token <your-token>
```

Or use environment variable:
```bash
export HCLOUD_TOKEN="your-token"
hcloud context create <name> --token-from-env
```

## Servers

List all servers:
```bash
hcloud server list
hcloud server list -o columns=id,name,type,status,datacenter,ipv4
```

Describe a server:
```bash
hcloud server describe <name-or-id>
```

Server power operations (⚠️ requires read-write token, ask user before executing):
```bash
hcloud server poweron <name>
hcloud server poweroff <name>
hcloud server reboot <name>
hcloud server shutdown <name>    # Graceful shutdown
hcloud server reset <name>       # Hard reset
```

SSH into a server:
```bash
hcloud server ssh <name>
```

Get server IP:
```bash
hcloud server ip <name>
```

## Server Types (Instance Types)

List all available server types:
```bash
hcloud server-type list
```

Describe a specific type:
```bash
hcloud server-type describe cax21
```

### Server Type Families

| Series | CPU Type | Description |
|--------|----------|-------------|
| CAX | ARM (Ampere) | Best price/performance for ARM workloads |
| CX | x86 shared | Intel/AMD shared vCPU |
| CPX | x86 shared | More disk-focused variants |
| CCX | x86 dedicated | Dedicated AMD EPYC cores |

## Volumes

List volumes:
```bash
hcloud volume list
```

Create a volume (⚠️ requires read-write token):
```bash
hcloud volume create --name my-volume --size 100 --location fsn1
```

Attach/detach (⚠️ requires read-write token):
```bash
hcloud volume attach <volume> --server <server>
hcloud volume detach <volume>
```

## Networks

List networks:
```bash
hcloud network list
```

Describe network:
```bash
hcloud network describe <name>
```

## Firewalls

List firewalls:
```bash
hcloud firewall list
```

Describe firewall with rules:
```bash
hcloud firewall describe <name>
```

## Locations & Datacenters

List locations:
```bash
hcloud location list
```

List datacenters:
```bash
hcloud datacenter list
```

## Images

List available images:
```bash
hcloud image list
hcloud image list --type system    # OS images only
```

## SSH Keys

List SSH keys:
```bash
hcloud ssh-key list
```

## JSON Output

Most commands support `-o json` for structured output:
```bash
hcloud server list -o json
hcloud server-type list -o json | jq '.[] | {name, cores, memory, disk}'
```

## Common Patterns

Check server status:
```bash
hcloud server list -o columns=name,status,type
```

Find servers by label:
```bash
hcloud server list --selector env=staging
```

Get all server types sorted by cores:
```bash
hcloud server-type list -o json | jq 'sort_by(.cores) | .[] | "\(.name): \(.cores) cores, \(.memory)GB RAM, \(.disk)GB disk"'
```
