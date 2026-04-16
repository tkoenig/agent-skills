#!/usr/bin/env bash
# Create a BambuStudio-compatible 3MF file using the BambuStudio CLI backend.
# Supports multiple STL inputs, auto-arrange, auto-orient, plate naming, and slicing in one step.
#
# Usage:
#   create-3mf-cli.sh <input.stl> [input2.stl ...] <output.3mf> [options]
#
# Options:
#   --preset <name>         Use a preset (default, solid, fast, fine, strong)
#   --setting key=value     Override a print setting (repeatable)
#   --filament <name>       Use a specific filament profile
#   --machine <name>        Use a specific machine/nozzle profile
#   --arrange               Auto-arrange objects on the plate
#   --orient                Auto-orient objects for best printability
#   --by-object             Set print sequence to "by object" (sequential)
#   --plate-names "A;B"     Set per-plate names shown in BambuStudio
#   --slice                 Also slice to gcode.3mf in one step
#   --list-presets          Show available presets
#   --list-filaments        Show available filament profiles
#   --list-machines         Show available machine/nozzle profiles
#
# Requires the BambuStudio CLI. Set BAMBU_CLI to override the path.
#
# Examples:
#   create-3mf-cli.sh model.stl model.3mf --preset strong
#   create-3mf-cli.sh model.stl model.3mf --plate-names "Front"
#   create-3mf-cli.sh part1.stl part2.stl plate.3mf --preset solid --arrange
#   create-3mf-cli.sh part1.stl part2.stl plate.3mf --plate-names "Front;Back" --arrange
#   create-3mf-cli.sh a.stl b.stl plate.3mf --preset strong --arrange --by-object --slice

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"

# --- BambuStudio CLI ---
DEFAULT_BAMBU_CLI="$HOME/Development/tkoenig/playground/bambustudio/install_dir/bin/BambuStudio.app/Contents/MacOS/BambuStudio"
BAMBU_CLI="${BAMBU_CLI:-$DEFAULT_BAMBU_CLI}"

# --- Presets ---
declare -A PRESET_SETTINGS
PRESET_SETTINGS[default]="layer_height=0.2 initial_layer_print_height=0.2 wall_loops=3 top_shell_layers=4 bottom_shell_layers=3 sparse_infill_density=15% sparse_infill_pattern=gyroid enable_support=0 brim_type=auto_brim"
PRESET_SETTINGS[solid]="layer_height=0.2 initial_layer_print_height=0.2 wall_loops=4 top_shell_layers=5 bottom_shell_layers=5 sparse_infill_density=100% sparse_infill_pattern=zig-zag enable_support=0 brim_type=auto_brim"
PRESET_SETTINGS[fast]="layer_height=0.28 initial_layer_print_height=0.28 wall_loops=2 top_shell_layers=3 bottom_shell_layers=3 sparse_infill_density=10% sparse_infill_pattern=gyroid enable_support=0 brim_type=auto_brim"
PRESET_SETTINGS[fine]="layer_height=0.12 initial_layer_print_height=0.12 wall_loops=3 top_shell_layers=5 bottom_shell_layers=5 sparse_infill_density=15% sparse_infill_pattern=gyroid enable_support=0 brim_type=auto_brim"
PRESET_SETTINGS[strong]="layer_height=0.2 initial_layer_print_height=0.2 wall_loops=5 top_shell_layers=5 bottom_shell_layers=5 sparse_infill_density=40% sparse_infill_pattern=cubic enable_support=0 brim_type=auto_brim"

# --- Parse arguments ---
STL_FILES=()
OUTPUT=""
PRESET="default"
SETTINGS=()
FILAMENT=""
MACHINE=""
ARRANGE=0
ORIENT=0
BY_OBJECT=0
SLICE=0
PLATE_NAMES=""
LIST_PRESETS=0
LIST_FILAMENTS=0
LIST_MACHINES=0

while [ $# -gt 0 ]; do
    case "$1" in
        --preset)
            PRESET="$2"; shift 2 ;;
        --setting)
            SETTINGS+=("$2"); shift 2 ;;
        --filament)
            FILAMENT="$2"; shift 2 ;;
        --machine)
            MACHINE="$2"; shift 2 ;;
        --arrange)
            ARRANGE=1; shift ;;
        --orient)
            ORIENT=1; shift ;;
        --by-object)
            BY_OBJECT=1; shift ;;
        --plate-names)
            PLATE_NAMES="$2"; shift 2 ;;
        --slice)
            SLICE=1; shift ;;
        --list-presets)
            LIST_PRESETS=1; shift ;;
        --list-filaments)
            LIST_FILAMENTS=1; shift ;;
        --list-machines)
            LIST_MACHINES=1; shift ;;
        -h|--help)
            echo "Usage: create-3mf-cli.sh <input.stl> [input2.stl ...] <output.3mf> [options]"
            echo ""
            echo "Create a BambuStudio 3MF from one or more STL files using the BambuStudio CLI."
            echo ""
            echo "Options:"
            echo "  --preset <name>      Preset: default, solid, fast, fine, strong"
            echo "  --setting key=value  Override setting (repeatable)"
            echo "  --filament <name>    Filament profile from filaments.json"
            echo "  --machine <name>     Machine/nozzle profile from machines.json"
            echo "  --arrange            Auto-arrange objects on the plate"
            echo "  --orient             Auto-orient objects"
            echo "  --by-object          Sequential printing (one object at a time)"
            echo "  --plate-names A;B    Set per-plate names shown in BambuStudio"
            echo "  --slice              Also slice to .gcode.3mf"
            echo "  --list-presets       Show available presets"
            echo "  --list-filaments     Show available filament profiles"
            echo "  --list-machines      Show available machine/nozzle profiles"
            exit 0
            ;;
        *.stl|*.STL)
            STL_FILES+=("$1"); shift ;;
        *.3mf|*.3MF)
            OUTPUT="$1"; shift ;;
        *)
            echo "ERROR: Unknown argument: $1" >&2
            exit 1 ;;
    esac
done

# --- List commands ---
if [ "$LIST_PRESETS" = "1" ]; then
    echo "Available presets:"
    echo "  default    0.2mm, 15% gyroid, 3 walls     General purpose"
    echo "  solid      0.2mm, 100% zig-zag, 4 walls   Solid functional parts"
    echo "  fast       0.28mm, 10% gyroid, 2 walls     Quick prototypes"
    echo "  fine       0.12mm, 15% gyroid, 3 walls     Decorative parts"
    echo "  strong     0.2mm, 40% cubic, 5 walls       Load-bearing parts"
    exit 0
fi

if [ "$LIST_FILAMENTS" = "1" ]; then
    python3 "$SCRIPT_DIR/create-3mf.py" --list-filaments
    exit 0
fi

if [ "$LIST_MACHINES" = "1" ]; then
    python3 "$SCRIPT_DIR/create-3mf.py" --list-machines
    exit 0
fi

# --- Validate ---
if [ ${#STL_FILES[@]} -eq 0 ] || [ -z "$OUTPUT" ]; then
    echo "Usage: create-3mf-cli.sh <input.stl> [input2.stl ...] <output.3mf> [options]"
    echo "Run with --help for details."
    exit 1
fi

if [ ! -x "$BAMBU_CLI" ]; then
    echo "ERROR: BambuStudio CLI not found at: $BAMBU_CLI" >&2
    echo "Falling back to Python-based create-3mf.sh..." >&2
    # Fall back to Python tool (single STL only)
    if [ ${#STL_FILES[@]} -gt 1 ]; then
        echo "ERROR: Multiple STLs require the BambuStudio CLI." >&2
        exit 1
    fi
    FALLBACK_ARGS=("${STL_FILES[0]}" "$OUTPUT" --preset "$PRESET")
    [ -n "$FILAMENT" ] && FALLBACK_ARGS+=(--filament "$FILAMENT")
    [ -n "$MACHINE" ] && FALLBACK_ARGS+=(--machine "$MACHINE")
    [ "$BY_OBJECT" = "1" ] && FALLBACK_ARGS+=(--by-object)
    if [ -n "$PLATE_NAMES" ]; then
        if [[ "$PLATE_NAMES" == *";"* ]]; then
            echo "ERROR: Multiple plate names require the BambuStudio CLI." >&2
            exit 1
        fi
        FALLBACK_ARGS+=(--plate-name "$PLATE_NAMES")
    fi
    for s in "${SETTINGS[@]}"; do FALLBACK_ARGS+=(--setting "$s"); done
    exec "$SCRIPT_DIR/create-3mf.sh" "${FALLBACK_ARGS[@]}"
fi

for f in "${STL_FILES[@]}"; do
    if [ ! -f "$f" ]; then
        echo "ERROR: STL file not found: $f" >&2
        exit 1
    fi
done

# Make output path absolute
case "$OUTPUT" in
    /*) ABS_OUTPUT="$OUTPUT" ;;
    *) ABS_OUTPUT="$(pwd)/$OUTPUT" ;;
esac

# --- Find filaments.json ---
find_filaments_json() {
    local d="$(pwd)"
    while true; do
        if [ -f "$d/filaments.json" ]; then
            echo "$d/filaments.json"
            return
        fi
        local parent="$(dirname "$d")"
        [ "$parent" = "$d" ] && return
        d="$parent"
    done
}

find_machines_json() {
    local d="$(pwd)"
    while true; do
        if [ -f "$d/machines.json" ]; then
            echo "$d/machines.json"
            return
        fi
        local parent="$(dirname "$d")"
        [ "$parent" = "$d" ] && return
        d="$parent"
    done
}

# --- Build settings files ---
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

# Base settings from our template
BASE_TEMPLATE="$SKILL_DIR/settings/base_template.json"

python3 - "$BASE_TEMPLATE" "$TMPDIR" "$PRESET" "$FILAMENT" "$MACHINE" "$(find_filaments_json)" "$(find_machines_json)" "${SETTINGS[@]}" << 'PYEOF'
import ast, json, sys, os, re

base_template = sys.argv[1]
tmpdir = sys.argv[2]
preset_name = sys.argv[3]
filament_name = sys.argv[4] if sys.argv[4] else None
machine_name = sys.argv[5] if sys.argv[5] else None
filaments_path = sys.argv[6] if sys.argv[6] else None
machines_path = sys.argv[7] if sys.argv[7] else None
overrides = sys.argv[8:]

# Presets
PRESETS = {
    "default": {"layer_height": "0.2", "initial_layer_print_height": "0.2", "wall_loops": "3",
                "top_shell_layers": "4", "bottom_shell_layers": "3", "sparse_infill_density": "15%",
                "sparse_infill_pattern": "gyroid", "enable_support": "0", "brim_type": "auto_brim"},
    "solid":   {"layer_height": "0.2", "initial_layer_print_height": "0.2", "wall_loops": "4",
                "top_shell_layers": "5", "bottom_shell_layers": "5", "sparse_infill_density": "100%",
                "sparse_infill_pattern": "zig-zag", "enable_support": "0", "brim_type": "auto_brim"},
    "fast":    {"layer_height": "0.28", "initial_layer_print_height": "0.28", "wall_loops": "2",
                "top_shell_layers": "3", "bottom_shell_layers": "3", "sparse_infill_density": "10%",
                "sparse_infill_pattern": "gyroid", "enable_support": "0", "brim_type": "auto_brim"},
    "fine":    {"layer_height": "0.12", "initial_layer_print_height": "0.12", "wall_loops": "3",
                "top_shell_layers": "5", "bottom_shell_layers": "5", "sparse_infill_density": "15%",
                "sparse_infill_pattern": "gyroid", "enable_support": "0", "brim_type": "auto_brim"},
    "strong":  {"layer_height": "0.2", "initial_layer_print_height": "0.2", "wall_loops": "5",
                "top_shell_layers": "5", "bottom_shell_layers": "5", "sparse_infill_density": "40%",
                "sparse_infill_pattern": "cubic", "enable_support": "0", "brim_type": "auto_brim"},
}

def load_named_profile(path, collection_key, requested_name, config_label):
    if not path or not os.path.exists(path):
        if requested_name:
            print(f"ERROR: No {config_label} found (searched from cwd upward)", file=sys.stderr)
            sys.exit(1)
        return None, None

    with open(path) as f:
        data = json.load(f)

    profiles = data.get(collection_key, {})
    selected_name = requested_name or data.get("default")
    if not selected_name:
        return None, None
    if selected_name not in profiles:
        available = ", ".join(profiles.keys())
        print(f"ERROR: Unknown {config_label.rstrip('.json')} '{selected_name}'. Available: {available}", file=sys.stderr)
        sys.exit(1)

    profile = dict(profiles[selected_name])
    display_name = profile.pop("name", selected_name)
    return profile, display_name


def coerce_string_list(value):
    if isinstance(value, list):
        return [str(v) for v in value]
    if isinstance(value, tuple):
        return [str(v) for v in value]
    if isinstance(value, str):
        text = value.strip()
        if text.startswith("["):
            try:
                parsed = ast.literal_eval(text)
                if isinstance(parsed, (list, tuple)):
                    return [str(v) for v in parsed]
            except (SyntaxError, ValueError):
                pass
        return [value]
    return [str(value)]


def normalize_machine_settings(settings):
    printer_id = settings.get("printer_settings_id")
    if printer_id:
        settings["print_compatible_printers"] = [printer_id]
        settings["compatible_printers"] = [printer_id]
    if "upward_compatible_machine" not in settings:
        settings["upward_compatible_machine"] = []
    if "nozzle_diameter" not in settings and printer_id:
        match = re.search(r"([0-9.]+) nozzle$", printer_id)
        if match:
            settings["nozzle_diameter"] = [match.group(1)]

    for key in ["nozzle_diameter", "compatible_printers", "print_compatible_printers", "upward_compatible_machine"]:
        if key in settings:
            settings[key] = coerce_string_list(settings[key])

    return settings


def build_process_id(settings, preset_name):
    printer_profile = settings.get("printer_settings_id", "Bambu Lab A1 0.4 nozzle")
    printer_suffix = printer_profile.replace("Bambu Lab ", "BBL ")
    layer = settings.get("layer_height", "0.2")
    try:
        layer_label = f"{float(layer):.2f}mm"
    except (TypeError, ValueError):
        layer_label = f"{layer}mm"

    if str(settings.get("spiral_mode", "0")) == "1":
        label = "Vase Widewall" if str(settings.get("outer_wall_line_width", "")) != str(settings.get("line_width", "")) else "Vase"
    else:
        label = {
            "default": "Default",
            "solid": "Solid",
            "fast": "Fast",
            "fine": "Fine",
            "strong": "Strong",
        }.get(preset_name, "Custom")

    return f"{layer_label} {label} @{printer_suffix}"


# Load base template
with open(base_template) as f:
    settings = json.load(f)

# Apply preset
if preset_name in PRESETS:
    settings.update(PRESETS[preset_name])

# Apply machine/nozzle profile
machine_profile, machine_display = load_named_profile(machines_path, "machines", machine_name, "machines.json")
if machine_profile:
    settings.update(machine_profile)

# Apply filament profile
filament_profile, filament_display = load_named_profile(filaments_path, "filaments", filament_name, "filaments.json")
if filament_profile:
    settings.update(filament_profile)

# Apply overrides
override_keys = set()
for o in overrides:
    if "=" in o:
        k, v = o.split("=", 1)
        settings[k] = v
        override_keys.add(k)

# Validate 100% infill pattern
if settings.get("sparse_infill_density") == "100%":
    bad = ["cubic", "gyroid", "honeycomb", "adaptivecubic", "3dhoneycomb", "hilbertcurve", "lightning"]
    if settings.get("sparse_infill_pattern") in bad:
        settings["sparse_infill_pattern"] = "zig-zag"
        print(f"  ⚠️  Changed infill pattern to zig-zag (required for 100%)", file=sys.stderr)

if "print_settings_id" not in override_keys:
    settings["print_settings_id"] = build_process_id(settings, preset_name)

settings = normalize_machine_settings(settings)

# Write process settings
process = dict(settings)
process["from"] = "system"
process["type"] = "process"
process["name"] = settings.get("print_settings_id", build_process_id(settings, preset_name))
process["compatible_printers"] = settings.get("print_compatible_printers", [settings.get("printer_settings_id", "Bambu Lab A1 0.4 nozzle")])
with open(os.path.join(tmpdir, "process.json"), "w") as f:
    json.dump(process, f, indent=2)

# Write machine settings (subset of base template with printer-specific keys)
machine_keys = [k for k in settings if any(k.startswith(p) for p in [
    "machine_", "printer_", "nozzle_", "printable_", "bed_", "curr_bed",
    "extruder_", "retract", "wipe", "z_hop"
])]
machine = {k: settings[k] for k in machine_keys}
machine["from"] = "system"
machine["type"] = "machine"
machine["name"] = settings.get("printer_settings_id", "Bambu Lab A1 0.4 nozzle")
with open(os.path.join(tmpdir, "machine.json"), "w") as f:
    json.dump(machine, f, indent=2)

# Write filament settings
if filament_profile:
    filament_output = dict(filament_profile)
    filament_output["from"] = "system"
    filament_output["type"] = "filament"
    filament_output["name"] = filament_display
    with open(os.path.join(tmpdir, "filament.json"), "w") as f:
        json.dump(filament_output, f, indent=2)

# Print summary
layer = settings.get("layer_height", "?")
density = settings.get("sparse_infill_density", "?")
pattern = settings.get("sparse_infill_pattern", "?")
walls = settings.get("wall_loops", "?")
support = "on" if settings.get("enable_support") == "1" else "off"
print(f"  Preset: {preset_name}", file=sys.stderr)
if machine_display:
    print(f"  Machine: {machine_display}", file=sys.stderr)
if filament_display:
    print(f"  Filament: {filament_display}", file=sys.stderr)
print(f"  Layer height: {layer}mm", file=sys.stderr)
print(f"  Infill: {density} ({pattern})", file=sys.stderr)
print(f"  Walls: {walls}", file=sys.stderr)
print(f"  Support: {support}", file=sys.stderr)
PYEOF

# --- Build CLI command ---
CLI_ARGS=()

# Add STL files (absolute paths)
for f in "${STL_FILES[@]}"; do
    case "$f" in
        /*) CLI_ARGS+=("$f") ;;
        *) CLI_ARGS+=("$(pwd)/$f") ;;
    esac
done

# Settings (process + machine)
CLI_ARGS+=(--load-settings "$TMPDIR/process.json;$TMPDIR/machine.json")
[ -f "$TMPDIR/filament.json" ] && CLI_ARGS+=(--load-filaments "$TMPDIR/filament.json")

# Always ensure objects sit on bed
CLI_ARGS+=(--ensure-on-bed)

# Options
[ "$ARRANGE" = "1" ] && CLI_ARGS+=(--arrange 1)
[ "$ORIENT" = "1" ] && CLI_ARGS+=(--orient 1)

# Slice or just export
if [ "$SLICE" = "1" ]; then
    GCODE_OUTPUT="${ABS_OUTPUT%.3mf}.gcode.3mf"
    CLI_ARGS+=(--slice 0 --export-3mf "$GCODE_OUTPUT")
else
    CLI_ARGS+=(--export-3mf "$ABS_OUTPUT")
fi

# --- Print header ---
echo "Creating 3MF (CLI): ${STL_FILES[*]} → $(basename "$OUTPUT")"
[ "$ARRANGE" = "1" ] && echo "  Auto-arrange: on"
[ "$ORIENT" = "1" ] && echo "  Auto-orient: on"
[ "$BY_OBJECT" = "1" ] && echo "  Print sequence: by object"
[ -n "$PLATE_NAMES" ] && echo "  Plate names: $PLATE_NAMES"
[ "$SLICE" = "1" ] && echo "  Slice: yes → $(basename "$GCODE_OUTPUT")"

# --- Run BambuStudio CLI ---
"$BAMBU_CLI" "${CLI_ARGS[@]}" 2>&1 | grep -v "^\[.*\] \[.*\] \[trace\]" >&2 || true
EXIT_CODE=${PIPESTATUS[0]}

if [ $EXIT_CODE -ne 0 ]; then
    echo "ERROR: BambuStudio CLI exited with code $EXIT_CODE" >&2
    exit $EXIT_CODE
fi

# --- Sanitize XML (BambuStudio CLI doesn't escape &, <, >, " in XML attributes) ---
for f in "$ABS_OUTPUT" ${SLICE:+"$GCODE_OUTPUT"}; do
    [ -f "$f" ] && python3 "$SCRIPT_DIR/sanitize-3mf-xml.py" "$f"
done

# --- Post-process: plate names + print sequence ---
PATCH_ARGS=(--auto-plate-names)
[ "$BY_OBJECT" = "1" ] && PATCH_ARGS+=(--print-sequence "by object")
[ -n "$PLATE_NAMES" ] && PATCH_ARGS+=(--plate-names "$PLATE_NAMES")

TARGETS=()
[ -f "$ABS_OUTPUT" ] && TARGETS+=("$ABS_OUTPUT")
[ "$SLICE" = "1" ] && [ -f "$GCODE_OUTPUT" ] && TARGETS+=("$GCODE_OUTPUT")

for TARGET in "${TARGETS[@]}"; do
    python3 "$SCRIPT_DIR/patch-3mf-metadata.py" "$TARGET" "${PATCH_ARGS[@]}"
done

# --- Summary ---
if [ "$SLICE" = "1" ]; then
    if [ -f "$GCODE_OUTPUT" ]; then
        SIZE=$(stat -f%z "$GCODE_OUTPUT" 2>/dev/null || stat -c%s "$GCODE_OUTPUT" 2>/dev/null)
        echo "✅ Done: $(basename "$GCODE_OUTPUT") ($(( SIZE / 1024 ))KB)"
    fi
    # Also export the non-sliced 3MF for reference
    if [ -f "$ABS_OUTPUT" ]; then
        SIZE=$(stat -f%z "$ABS_OUTPUT" 2>/dev/null || stat -c%s "$ABS_OUTPUT" 2>/dev/null)
        echo "   Also: $(basename "$ABS_OUTPUT") ($(( SIZE / 1024 ))KB)"
    fi
else
    if [ -f "$ABS_OUTPUT" ]; then
        SIZE=$(stat -f%z "$ABS_OUTPUT" 2>/dev/null || stat -c%s "$ABS_OUTPUT" 2>/dev/null)
        echo "✅ Done: $(basename "$ABS_OUTPUT") ($(( SIZE / 1024 ))KB)"
    fi
fi
