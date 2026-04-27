#!/bin/bash
# Common utilities for OpenSCAD tools

# Find OpenSCAD executable
find_openscad() {
    # Check common locations
    if command -v openscad &> /dev/null; then
        echo "openscad"
        return 0
    fi

    # macOS Application bundle
    if [ -d "/Applications/OpenSCAD.app" ]; then
        echo "/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD"
        return 0
    fi

    # Homebrew on Apple Silicon
    if [ -x "/opt/homebrew/bin/openscad" ]; then
        echo "/opt/homebrew/bin/openscad"
        return 0
    fi

    # Homebrew on Intel
    if [ -x "/usr/local/bin/openscad" ]; then
        echo "/usr/local/bin/openscad"
        return 0
    fi

    return 1
}

# Check if OpenSCAD is available
check_openscad() {
    OPENSCAD=$(find_openscad) || {
        echo "Error: OpenSCAD not found!"
        echo ""
        echo "Install OpenSCAD using one of:"
        echo "  brew install openscad"
        echo "  Download from https://openscad.org/downloads.html"
        exit 1
    }
    export OPENSCAD
}

# Get version info
openscad_version() {
    check_openscad
    $OPENSCAD --version 2>&1
}

# Find matching OpenSCAD Customizer sidecar JSON
find_customizer_params() {
    local input="$1"
    local params_file="${input%.scad}.json"

    if [ -f "$params_file" ]; then
        echo "$params_file"
    fi
}

# Resolve which Customizer parameter set to use
resolve_customizer_preset() {
    local params_file="$1"
    local requested_preset="$2"

    if ! command -v python3 &> /dev/null; then
        echo "Error: python3 is required to read Customizer presets from $params_file" >&2
        return 1
    fi

    python3 - "$params_file" "$requested_preset" <<'PY'
import json
import sys

params_file = sys.argv[1]
requested = sys.argv[2]

with open(params_file, "r", encoding="utf-8") as f:
    data = json.load(f)

parameter_sets = data.get("parameterSets") or {}
if not parameter_sets:
    sys.exit(0)

if requested:
    if requested not in parameter_sets:
        print(f"Error: Customizer preset not found in {params_file}: {requested}", file=sys.stderr)
        sys.exit(1)
    print(requested)
else:
    print(next(iter(parameter_sets)))
PY
}

# Populate CUSTOMIZER_ARGS/CUSTOMIZER_PARAMS_FILE/CUSTOMIZER_PRESET when a
# matching <model>.json Customizer file exists.
setup_customizer_args() {
    local input="$1"
    local requested_preset="${2:-}"
    local use_customizer="${3:-true}"
    local params_file
    local preset

    CUSTOMIZER_ARGS=()
    CUSTOMIZER_PARAMS_FILE=""
    CUSTOMIZER_PRESET=""

    if [ "$use_customizer" != "true" ]; then
        return 0
    fi

    params_file=$(find_customizer_params "$input")
    if [ -z "$params_file" ]; then
        return 0
    fi

    preset=$(resolve_customizer_preset "$params_file" "$requested_preset")
    if [ -z "$preset" ]; then
        return 0
    fi

    CUSTOMIZER_ARGS=(-p "$params_file" -P "$preset")
    CUSTOMIZER_PARAMS_FILE="$params_file"
    CUSTOMIZER_PRESET="$preset"
}

print_customizer_notice() {
    if [ -n "$CUSTOMIZER_PARAMS_FILE" ] && [ -n "$CUSTOMIZER_PRESET" ]; then
        echo "Customizer preset: $CUSTOMIZER_PRESET ($CUSTOMIZER_PARAMS_FILE)"
    fi
}
