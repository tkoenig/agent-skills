#!/bin/bash
# Slice a 3MF file using the BambuStudio CLI.
# Produces a .gcode.3mf file ready for upload to the printer.
#
# Usage:
#   slice-3mf.sh <input.3mf> [output.gcode.3mf] [options]
#
# Options:
#   --orient       Auto-orient model for optimal print orientation
#   --arrange      Auto-arrange models on the plate
#
# If no output path is given, replaces .3mf with .gcode.3mf in the same directory.
#
# Prerequisites:
#   BambuStudio CLI. Prefers the stock app at
#   /Applications/BambuStudio.app/Contents/MacOS/BambuStudio and falls back to
#   the custom build used during earlier macOS CLI issues.
#   Set BAMBU_CLI to override the binary path.
#
# Examples:
#   slice-3mf.sh model.3mf
#   slice-3mf.sh model.3mf sliced/model.gcode.3mf
#   slice-3mf.sh model.3mf --orient
#   BAMBU_CLI=/path/to/BambuStudio slice-3mf.sh model.3mf

set -e

# --- Locate BambuStudio CLI binary ---
OVERRIDE_BAMBU_CLI="${BAMBU_CLI:-}"
STOCK_BAMBU_CLI="/Applications/BambuStudio.app/Contents/MacOS/BambuStudio"
CUSTOM_BAMBU_CLI="$HOME/Development/tkoenig/playground/bambustudio/install_dir/bin/BambuStudio.app/Contents/MacOS/BambuStudio"

if [ -n "$OVERRIDE_BAMBU_CLI" ]; then
    BAMBU_CLI="$OVERRIDE_BAMBU_CLI"
elif [ -x "$STOCK_BAMBU_CLI" ]; then
    BAMBU_CLI="$STOCK_BAMBU_CLI"
elif [ -x "$CUSTOM_BAMBU_CLI" ]; then
    BAMBU_CLI="$CUSTOM_BAMBU_CLI"
else
    BAMBU_CLI="$STOCK_BAMBU_CLI"
fi

if [ ! -x "$BAMBU_CLI" ]; then
    echo "ERROR: BambuStudio CLI not found at: $BAMBU_CLI"
    if [ -z "$OVERRIDE_BAMBU_CLI" ]; then
        echo "Searched stock CLI:  $STOCK_BAMBU_CLI"
        echo "Searched custom CLI: $CUSTOM_BAMBU_CLI"
    fi
    echo ""
    echo "Set BAMBU_CLI to point to your BambuStudio binary:"
    echo "  export BAMBU_CLI=/path/to/BambuStudio"
    exit 1
fi

# --- Parse arguments ---
INPUT=""
OUTPUT=""
EXTRA_ARGS=()

for arg in "$@"; do
    case "$arg" in
        -h|--help)
            echo "Usage: slice-3mf.sh <input.3mf> [output.gcode.3mf] [options]"
            echo ""
            echo "Slice a 3MF file using BambuStudio CLI."
            echo "Output defaults to <input>.gcode.3mf if not specified."
            echo ""
            echo "Options:"
            echo "  --orient    Auto-orient model for optimal print orientation"
            echo "  --arrange   Auto-arrange models on the plate"
            exit 0
            ;;
        --orient)
            EXTRA_ARGS+=(--orient 1)
            ;;
        --arrange)
            EXTRA_ARGS+=(--arrange 1)
            ;;
        *)
            if [ -z "$INPUT" ]; then
                INPUT="$arg"
            elif [ -z "$OUTPUT" ]; then
                OUTPUT="$arg"
            fi
            ;;
    esac
done

if [ -z "$INPUT" ]; then
    echo "Usage: slice-3mf.sh <input.3mf> [output.gcode.3mf] [options]"
    exit 1
fi

INPUT="$(cd "$(dirname "$INPUT")" && pwd)/$(basename "$INPUT")"

if [ ! -f "$INPUT" ]; then
    echo "ERROR: Input file not found: $INPUT"
    exit 1
fi

if [ -n "$OUTPUT" ]; then
    # Make absolute if relative
    case "$OUTPUT" in
        /*) ;;
        *) OUTPUT="$(pwd)/$OUTPUT" ;;
    esac
else
    OUTPUT="${INPUT%.3mf}.gcode.3mf"
fi

# Create output directory if needed
mkdir -p "$(dirname "$OUTPUT")"

# --- Slice ---
echo "Slicing: $(basename "$INPUT")"
[ ${#EXTRA_ARGS[@]} -gt 0 ] && echo "Options: ${EXTRA_ARGS[*]}"
echo "Output:  $(basename "$OUTPUT")"

"$BAMBU_CLI" --slice 0 --export-3mf "$OUTPUT" "${EXTRA_ARGS[@]}" "$INPUT" 2>&1 | grep -v "^\[.*\] \[.*\] \[trace\]" >&2 || true
EXIT_CODE=${PIPESTATUS[0]}

if [ $EXIT_CODE -ne 0 ]; then
    echo "ERROR: BambuStudio CLI exited with code $EXIT_CODE"
    exit $EXIT_CODE
fi

if [ ! -f "$OUTPUT" ]; then
    echo "ERROR: Slicing completed but output file was not created."
    echo "Check BambuStudio CLI output above for details."
    exit 1
fi

SIZE=$(stat -f%z "$OUTPUT" 2>/dev/null || stat -c%s "$OUTPUT" 2>/dev/null)
echo "Done: $(basename "$OUTPUT") ($(( SIZE / 1024 ))KB)"
