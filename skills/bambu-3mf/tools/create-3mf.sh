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
#   --list-presets          Show available presets
#   --list-settings         Show common settings
#
# Examples:
#   create-3mf.sh model.stl model.3mf
#   create-3mf.sh model.stl model.3mf --preset solid
#   create-3mf.sh model.stl model.3mf --setting layer_height=0.12 --setting wall_loops=4

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
python3 "$SCRIPT_DIR/create-3mf.py" "$@"
