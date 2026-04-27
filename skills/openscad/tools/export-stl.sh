#!/bin/bash
# Export OpenSCAD file to STL
# Usage: export-stl.sh input.scad output.stl [--customizer-preset <name>] [--no-customizer] [-D 'var=value' ...]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/common.sh"

check_openscad

if [ $# -lt 2 ]; then
    echo "Usage: $0 input.scad output.stl [--customizer-preset <name>] [--no-customizer] [-D 'var=value' ...]"
    echo ""
    echo "Examples:"
    echo "  $0 box.scad box.stl"
    echo "  $0 box.scad box.stl --customizer-preset 'New set 1'"
    echo "  $0 box.scad box_large.stl -D 'width=80' -D 'height=60'"
    echo "  $0 box.scad box_default.stl --no-customizer"
    exit 1
fi

INPUT="$1"
OUTPUT="$2"
shift 2

# Collect options
DEFINES=()
USE_CUSTOMIZER=true
CUSTOMIZER_PRESET_REQUESTED=""
while [ $# -gt 0 ]; do
    case "$1" in
        -D)
            shift
            DEFINES+=("-D" "$1")
            ;;
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

# Ensure output directory exists
mkdir -p "$(dirname "$OUTPUT")"

setup_customizer_args "$INPUT" "$CUSTOMIZER_PRESET_REQUESTED" "$USE_CUSTOMIZER"

echo "Exporting STL: $INPUT -> $OUTPUT"
print_customizer_notice
if [ ${#DEFINES[@]} -gt 0 ]; then
    echo "Parameters: ${DEFINES[*]}"
fi

$OPENSCAD \
    "${CUSTOMIZER_ARGS[@]}" \
    "${DEFINES[@]}" \
    -o "$OUTPUT" \
    "$INPUT"

# Show file info
SIZE=$(ls -lh "$OUTPUT" | awk '{print $5}')
echo "STL exported: $OUTPUT ($SIZE)"
