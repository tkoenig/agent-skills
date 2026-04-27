#!/bin/bash
# Create a BambuStudio-compatible 3MF file from an STL with print settings.
# Wrapper script around create-3mf.py
#
# Usage:
#   create-3mf.sh <input.stl> <output.3mf> [options]
#
# Options:
#   --preset <name>         Use a preset (default, solid, fast, fine, strong)
#   --setting key=value     Override a print setting (repeatable)
#   --orient                Auto-orient model for optimal print orientation
#   --filament <name>       Use a specific filament profile
#   --plate-name <name>     Set the plate name shown in BambuStudio
#   --list-presets          Show available presets
#   --list-settings         Show common settings
#   --list-filaments        Show available filament profiles
#
# Examples:
#   create-3mf.sh model.stl model.3mf
#   create-3mf.sh model.stl model.3mf --preset solid
#   create-3mf.sh model.stl model.3mf --plate-name "Front"
#   create-3mf.sh model.stl model.3mf --orient
#   create-3mf.sh model.stl model.3mf --setting layer_height=0.12 --setting wall_loops=4

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Check for --orient flag (handled here, not by Python)
ORIENT=0
PYTHON_ARGS=()
OUTPUT=""
for arg in "$@"; do
    if [ "$arg" = "--orient" ]; then
        ORIENT=1
    else
        PYTHON_ARGS+=("$arg")
        # Track the output file (second positional arg)
        case "$arg" in
            --*) ;;
            *.3mf) OUTPUT="$arg" ;;
        esac
    fi
done

python3 "$SCRIPT_DIR/create-3mf.py" "${PYTHON_ARGS[@]}"

if [ "$ORIENT" = "1" ] && [ -n "$OUTPUT" ] && [ -f "$OUTPUT" ]; then
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
        echo "⚠️  Cannot orient: BambuStudio CLI not found at $BAMBU_CLI"
        if [ -z "$OVERRIDE_BAMBU_CLI" ]; then
            echo "   Searched stock CLI:  $STOCK_BAMBU_CLI"
            echo "   Searched custom CLI: $CUSTOM_BAMBU_CLI"
        fi
        echo "   Set BAMBU_CLI to point to your BambuStudio binary."
        exit 0
    fi

    # Make path absolute for BambuStudio CLI
    case "$OUTPUT" in
        /*) ABS_OUTPUT="$OUTPUT" ;;
        *) ABS_OUTPUT="$(pwd)/$OUTPUT" ;;
    esac

    echo "Orienting..."
    BEST=$("$BAMBU_CLI" --orient 1 --export-3mf "$ABS_OUTPUT" "$ABS_OUTPUT" 2>&1 | grep "^best:" | head -1)
    if [ -n "$BEST" ]; then
        echo "  $BEST"
    fi
    echo "✅ Oriented!"
fi
