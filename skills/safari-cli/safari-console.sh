#!/bin/bash

# Retrieve captured console messages from Safari
# Usage: safari-console.sh [--clear] [--json] [type]
#   --clear  Clear messages after retrieving
#   --json   Output raw JSON instead of formatted text
#   type     Filter by type: log, warn, error, info, debug, uncaught

CLEAR=false
JSON_OUTPUT=false
FILTER_TYPE=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --clear)
            CLEAR=true
            shift
            ;;
        --json)
            JSON_OUTPUT=true
            shift
            ;;
        -h|--help)
            echo "Usage: safari-console.sh [--clear] [--json] [type]"
            echo ""
            echo "Retrieve captured console messages from Safari."
            echo ""
            echo "Options:"
            echo "  --clear  Clear messages after retrieving"
            echo "  --json   Output raw JSON instead of formatted text"
            echo "  type     Filter: log, warn, error, info, debug, uncaught"
            echo ""
            echo "Note: Run safari-console-install.sh first to enable capture."
            exit 0
            ;;
        *)
            FILTER_TYPE="$1"
            shift
            ;;
    esac
done

DIR="$(cd "$(dirname "$0")" && pwd)"

# Check if capture is installed
CHECK=$("$DIR/safari-eval.sh" "typeof window.__consoleCapture !== 'undefined'" 2>&1)
if [[ "$CHECK" != "true" ]]; then
    echo "✗ Console capture not installed"
    echo ""
    echo "Run first: $(dirname "$0")/safari-console-install.sh"
    exit 1
fi

# Build the retrieval script
if [[ -n "$FILTER_TYPE" ]]; then
    SCRIPT="window.__consoleCapture.filter(m => m.type === '$FILTER_TYPE')"
else
    SCRIPT="window.__consoleCapture"
fi

# Get messages
RESULT=$("$DIR/safari-eval.sh" "$SCRIPT" 2>&1)

if [[ $? -ne 0 ]]; then
    echo "$RESULT"
    exit 1
fi

# Clear if requested
if [[ "$CLEAR" == "true" ]]; then
    "$DIR/safari-eval.sh" "window.__consoleCapture = []" > /dev/null 2>&1
fi

# Output
if [[ "$JSON_OUTPUT" == "true" ]]; then
    echo "$RESULT"
else
    # Format output nicely
    echo "$RESULT" | python3 -c '
import sys
import json
from datetime import datetime

try:
    data = json.loads(sys.stdin.read())
except:
    print("No messages")
    sys.exit(0)

if not data:
    print("No messages")
    sys.exit(0)

icons = {
    "log": "   ",
    "info": "ℹ️ ",
    "warn": "⚠️ ",
    "error": "❌",
    "debug": "🔍",
    "uncaught": "💥"
}

for msg in data:
    ts = datetime.fromtimestamp(msg["timestamp"] / 1000).strftime("%H:%M:%S.%f")[:-3]
    icon = icons.get(msg["type"], "  ")
    mtype = msg["type"].upper().ljust(7)
    args = " ".join(msg["args"])
    print(f"[{ts}] {icon} {mtype} {args}")
'
fi
