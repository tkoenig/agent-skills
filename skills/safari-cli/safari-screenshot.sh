#!/bin/bash

# Take a screenshot of Safari window using Peekaboo
# Note: Includes browser chrome (tabs, address bar)

TIMESTAMP=$(date +%Y-%m-%dT%H-%M-%S)
FILENAME="screenshot-${TIMESTAMP}.png"
FILEPATH="${TMPDIR}${FILENAME}"

# Check if peekaboo is installed
if ! command -v peekaboo &> /dev/null; then
    echo "✗ Peekaboo not installed. Install with: brew install steipete/tap/peekaboo"
    exit 1
fi

# Get the main Safari window (first one with substantial height > 100)
WINDOW_ID=$(peekaboo list windows --app Safari --json 2>/dev/null | \
    python3 -c "
import sys, json
data = json.load(sys.stdin)
windows = data.get('data', {}).get('windows', [])
# Find first window with height > 100 (skip thin UI elements like tab bar strips)
for w in windows:
    bounds = w.get('bounds', [[0,0],[0,0]])
    height = bounds[1][1] if len(bounds) > 1 else 0
    if height > 100:
        print(w.get('window_id', ''))
        break
" 2>/dev/null)

if [ -z "$WINDOW_ID" ]; then
    echo "✗ No Safari window found"
    exit 1
fi

# Capture the specific window
peekaboo image --mode window --window-id "$WINDOW_ID" --path "$FILEPATH" >/dev/null 2>&1

if [ ! -f "$FILEPATH" ]; then
    echo "✗ Failed to capture screenshot"
    exit 1
fi

echo "$FILEPATH"
