#!/bin/bash
# Cloudflare MCP helper via MCPorter.
# Keeps MCPorter invocation consistent and uses latest MCPorter for newer HTTP/OAuth support.

set -euo pipefail

SERVER_NAME="${CLOUDFLARE_MCP_SERVER:-cloudflare-api}"
SERVER_URL="${CLOUDFLARE_MCP_URL:-https://mcp.cloudflare.com/mcp}"
MCPORTER=(npx --yes mcporter@latest)

usage() {
    cat <<EOF
Cloudflare MCP helper

Usage:
  $0 install                       Add Cloudflare MCP to MCPorter config via add-mcp
  $0 auth                          Start/refresh OAuth for Cloudflare MCP
  $0 status                        Check MCP auth/connection status
  $0 list [--schema]               List Cloudflare MCP tools
  $0 docs <query>                  Search Cloudflare developer docs
  $0 search <javascript-code>      Search the Cloudflare OpenAPI spec with Code Mode
  $0 execute <javascript-code> [account_id]
                                   Execute Cloudflare API code with Code Mode
  $0 raw <mcporter args...>        Pass arguments directly to mcporter

Environment:
  CLOUDFLARE_MCP_SERVER            MCPorter server name (default: cloudflare-api)
  CLOUDFLARE_MCP_URL               MCP URL (default: https://mcp.cloudflare.com/mcp)

Examples:
  $0 install
  $0 auth
  $0 status
  $0 docs "R2 bucket jurisdiction API"
  $0 search 'async () => Object.keys(spec.paths).filter(p => p.includes("/workers/scripts"))'
EOF
}

require_args() {
    local action="$1"
    local value="${2:-}"
    if [ -z "$value" ]; then
        echo "❌ Missing argument for '$action'" >&2
        echo "" >&2
        usage >&2
        exit 2
    fi
}

selector() {
    local tool="$1"
    echo "${SERVER_NAME}.${tool}"
}

ACTION="${1:-}"
shift || true

case "$ACTION" in
    install)
        npx --yes add-mcp "$SERVER_URL" -a mcporter -g --name "$SERVER_NAME" -y
        ;;
    auth)
        "${MCPORTER[@]}" auth "$SERVER_NAME"
        ;;
    status)
        "${MCPORTER[@]}" list "$SERVER_NAME" --status --json
        ;;
    list)
        "${MCPORTER[@]}" list "$SERVER_NAME" "$@"
        ;;
    docs)
        QUERY="$*"
        require_args docs "$QUERY"
        "${MCPORTER[@]}" call "$(selector docs)" "query=$QUERY"
        ;;
    search)
        CODE="$*"
        require_args search "$CODE"
        "${MCPORTER[@]}" call "$(selector search)" "code=$CODE"
        ;;
    execute)
        CODE="${1:-}"
        ACCOUNT_ID="${2:-}"
        require_args execute "$CODE"
        if [ -n "$ACCOUNT_ID" ]; then
            "${MCPORTER[@]}" call "$(selector execute)" "code=$CODE" "account_id=$ACCOUNT_ID"
        else
            "${MCPORTER[@]}" call "$(selector execute)" "code=$CODE"
        fi
        ;;
    raw)
        "${MCPORTER[@]}" "$@"
        ;;
    ""|-h|--help|help)
        usage
        ;;
    *)
        echo "❌ Unknown action: $ACTION" >&2
        echo "" >&2
        usage >&2
        exit 2
        ;;
esac
