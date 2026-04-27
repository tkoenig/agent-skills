#!/bin/bash
# Generate preview images from multiple angles
# Usage: multi-preview.sh input.scad output_dir/ [--customizer-preset <name>] [--no-customizer] [-D 'var=value']

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/common.sh"

check_openscad

if [ $# -lt 2 ]; then
    echo "Usage: $0 input.scad output_dir/ [--customizer-preset <name>] [--no-customizer] [-D 'var=value' ...]"
    exit 1
fi

INPUT="$1"
OUTPUT_DIR="$2"
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

mkdir -p "$OUTPUT_DIR"

setup_customizer_args "$INPUT" "$CUSTOMIZER_PRESET_REQUESTED" "$USE_CUSTOMIZER"

# Get base name without extension
BASENAME=$(basename "$INPUT" .scad)

echo "Generating multi-angle previews for: $INPUT"
echo "Output directory: $OUTPUT_DIR"
print_customizer_notice
echo ""

# Define angles as name:camera pairs
# Camera format: translate_x,translate_y,translate_z,rot_x,rot_y,rot_z,distance
ANGLES="iso:0,0,0,55,0,25,0
front:0,0,0,90,0,0,0
back:0,0,0,90,0,180,0
left:0,0,0,90,0,90,0
right:0,0,0,90,0,-90,0
top:0,0,0,0,0,0,0"

echo "$ANGLES" | while IFS=: read -r angle camera; do
    output="$OUTPUT_DIR/${BASENAME}_${angle}.png"

    echo "  Rendering $angle view..."
    $OPENSCAD \
        "${CUSTOMIZER_ARGS[@]}" \
        --camera="$camera" \
        --imgsize="800,600" \
        --colorscheme="Tomorrow Night" \
        --view=axes \
        --autocenter \
        --viewall \
        "${DEFINES[@]}" \
        -o "$output" \
        "$INPUT" 2>/dev/null
done

echo ""
echo "Generated previews:"
ls -la "$OUTPUT_DIR"/${BASENAME}_*.png
