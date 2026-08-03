#!/bin/bash
# Safari MCP helper via MCPorter.
# Uses Safari 27 beta when available, otherwise Safari Technology Preview.

set -euo pipefail

SERVER_NAME="${SAFARI_MCP_SERVER:-safari-mcp}"
SAFARI_DRIVER="/usr/bin/safaridriver"
STP_DRIVER="/Applications/Safari Technology Preview.app/Contents/MacOS/safaridriver"
# Safari tabs, console, and network recordings belong to one browser session. Tell
# MCPorter to route every invocation through its keep-alive daemon for this server.
export MCPORTER_KEEPALIVE="${MCPORTER_KEEPALIVE:+${MCPORTER_KEEPALIVE},}${SERVER_NAME}"
MCPORTER=(npx --yes mcporter@latest)

usage() {
    cat <<EOF
Safari MCP helper

Usage:
  $0 driver                         Print the selected MCP-capable safaridriver
  $0 install                        Add Safari MCP to MCPorter config
  $0 status                         Check driver support and MCPorter configuration
  $0 list [--schema]                List Safari MCP tools
  $0 call <tool> [key=value ...]    Call a Safari MCP tool
  $0 raw <mcporter args...>         Pass arguments directly to mcporter

Environment:
  SAFARI_MCP_SERVER                  MCPorter server name (default: safari-mcp)
  SAFARI_MCP_DRIVER                  Explicit safaridriver path (must support --mcp)
  SAFARI_MCP_SCOPE                   MCPorter config scope: home or project (default: home)

Examples:
  $0 install
  $0 list --schema
  $0 call navigate_to_url url=https://example.com
  $0 call evaluate_javascript script='document.title'
  $0 call screenshot
EOF
}

supports_mcp() {
    # safaridriver prints help successfully but exits non-zero on some releases.
    local help
    help=$("$1" --help 2>&1 || true)
    grep -Fq -- '--mcp' <<<"$help"
}

driver() {
    if [ -n "${SAFARI_MCP_DRIVER:-}" ]; then
        if [ ! -x "$SAFARI_MCP_DRIVER" ]; then
            echo "Safari MCP driver is not executable: $SAFARI_MCP_DRIVER" >&2
            exit 1
        fi
        if ! supports_mcp "$SAFARI_MCP_DRIVER"; then
            echo "Safari MCP driver does not support --mcp: $SAFARI_MCP_DRIVER" >&2
            exit 1
        fi
        echo "$SAFARI_MCP_DRIVER"
        return
    fi

    for candidate in "$SAFARI_DRIVER" "$STP_DRIVER"; do
        if [ -x "$candidate" ] && supports_mcp "$candidate"; then
            echo "$candidate"
            return
        fi
    done

    cat >&2 <<EOF
No MCP-capable Safari driver found.
Install Safari 27 beta or Safari Technology Preview, then enable:
  Safari Settings > Advanced > Show features for web developers
  Safari Settings > Developer > Allow/Enable remote automation and external agents
EOF
    exit 1
}

ACTION="${1:-}"
shift || true

case "$ACTION" in
    driver)
        driver
        ;;
    install)
        SCOPE="${SAFARI_MCP_SCOPE:-home}"
        if [ "$SCOPE" != "home" ] && [ "$SCOPE" != "project" ]; then
            echo "SAFARI_MCP_SCOPE must be home or project" >&2
            exit 2
        fi
        "${MCPORTER[@]}" config add "$SERVER_NAME" \
            --command "$(driver)" \
            --arg --mcp \
            --description "Safari MCP server for browser testing and debugging" \
            --scope "$SCOPE"
        ;;
    status)
        echo "Driver: $(driver)"
        "${MCPORTER[@]}" list "$SERVER_NAME" --status --json
        echo "Browser session:"
        "${MCPORTER[@]}" call "${SERVER_NAME}.list_tabs"
        ;;
    list)
        "${MCPORTER[@]}" list "$SERVER_NAME" "$@"
        ;;
    call)
        TOOL="${1:-}"
        if [ -z "$TOOL" ]; then
            echo "Missing Safari MCP tool name" >&2
            usage >&2
            exit 2
        fi
        shift
        "${MCPORTER[@]}" call "${SERVER_NAME}.${TOOL}" "$@"
        ;;
    raw)
        "${MCPORTER[@]}" "$@"
        ;;
    ""|-h|--help|help)
        usage
        ;;
    *)
        echo "Unknown action: $ACTION" >&2
        usage >&2
        exit 2
        ;;
esac
