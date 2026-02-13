#!/bin/bash
# Open a 3MF file in BambuStudio
#
# Usage:
#   open-bambu.sh <file.3mf>

set -e

if [ -z "$1" ]; then
    echo "Usage: open-bambu.sh <file.3mf>"
    exit 1
fi

FILE="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"

if [ ! -f "$FILE" ]; then
    echo "ERROR: File not found: $FILE"
    exit 1
fi

if [ ! -d "/Applications/BambuStudio.app" ]; then
    echo "ERROR: BambuStudio not found at /Applications/BambuStudio.app"
    exit 1
fi

echo "Opening in BambuStudio: $FILE"
open -a "/Applications/BambuStudio.app" "$FILE"
