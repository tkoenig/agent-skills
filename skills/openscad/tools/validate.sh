#!/bin/bash
# Validate an OpenSCAD file for syntax errors
# Usage: validate.sh input.scad [--customizer-preset <name>] [--no-customizer]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/common.sh"

check_openscad

if [ $# -lt 1 ]; then
    echo "Usage: $0 input.scad [--customizer-preset <name>] [--no-customizer]"
    exit 1
fi

INPUT="$1"
shift

USE_CUSTOMIZER=true
CUSTOMIZER_PRESET_REQUESTED=""
while [ $# -gt 0 ]; do
    case "$1" in
        --customizer-preset)
            shift
            CUSTOMIZER_PRESET_REQUESTED="$1"
            ;;
        --no-customizer)
            USE_CUSTOMIZER=false
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
    shift
done

if [ ! -f "$INPUT" ]; then
    echo "Error: File not found: $INPUT"
    exit 1
fi

setup_customizer_args "$INPUT" "$CUSTOMIZER_PRESET_REQUESTED" "$USE_CUSTOMIZER"

echo "Validating: $INPUT"
print_customizer_notice

# Create temp file for output
TEMP_OUTPUT=$(mktemp /tmp/openscad_validate.XXXXXX.echo)
trap "rm -f $TEMP_OUTPUT" EXIT

# Run OpenSCAD with echo output (fastest way to check syntax)
# Using --export-format=echo just parses and evaluates without rendering
if $OPENSCAD "${CUSTOMIZER_ARGS[@]}" -o "$TEMP_OUTPUT" --export-format=echo "$INPUT" 2>&1; then
    echo "✓ Syntax OK"

    # Check for warnings in stderr
    if [ -s "$TEMP_OUTPUT" ]; then
        echo ""
        echo "Echo output:"
        cat "$TEMP_OUTPUT"
    fi

    exit 0
else
    echo "✗ Validation failed"
    exit 1
fi
