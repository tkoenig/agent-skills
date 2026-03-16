---
name: bambu-3mf
description: "Create BambuStudio-compatible 3MF files from STL models with embedded print settings. Supports presets for common scenarios (solid, fast, fine, strong) and per-setting overrides."
---

# BambuStudio 3MF Skill

Create BambuStudio-compatible 3MF project files from STL models with embedded print settings. The generated 3MF files open directly in BambuStudio with all settings pre-configured — ready to slice and print.

## Prerequisites

- **lib3mf** Python package: `pip3 install lib3mf`
- **BambuStudio** at `/Applications/BambuStudio.app` (for opening files)
- **Base settings template** at `settings/base_template.json` (included)

## Tools

### Create 3MF (CLI backend — recommended)

Uses the BambuStudio CLI for native 3MF generation. Supports multiple STLs, auto-arrange, auto-orient, plate naming, and slicing in one step.

```bash
# Single STL with preset
{baseDir}/tools/create-3mf-cli.sh model.stl model.3mf --preset strong

# Single STL with a custom plate name
{baseDir}/tools/create-3mf-cli.sh model.stl model.3mf --plate-names "Front"

# Multiple STLs, auto-arranged on one or more plates
{baseDir}/tools/create-3mf-cli.sh part1.stl part2.stl plate.3mf --preset solid --arrange

# Multiple STLs with explicit per-plate names
{baseDir}/tools/create-3mf-cli.sh front.stl back.stl drawer.3mf --arrange --plate-names "Front;Back"

# Full pipeline: arrange + sequential print + slice in one step
{baseDir}/tools/create-3mf-cli.sh a.stl b.stl plate.3mf --preset strong --arrange --by-object --slice

# With specific filament and auto-orient
{baseDir}/tools/create-3mf-cli.sh model.stl model.3mf --preset strong --filament esun-petg-basic --orient

# List presets or filaments
{baseDir}/tools/create-3mf-cli.sh --list-presets
{baseDir}/tools/create-3mf-cli.sh --list-filaments
```

If `--plate-names` is omitted, the tool auto-fills plate names from the STL basenames whenever it can determine a sensible one-object-per-plate mapping.

Falls back to the Python-based tool for single STL if CLI is unavailable.

### Create 3MF (Python fallback)

Python-based 3MF creation using lib3mf. Works without BambuStudio CLI but only supports single STL input.

```bash
# Default settings (0.2mm, 15% gyroid infill, 3 walls)
{baseDir}/tools/create-3mf.sh model.stl model.3mf

# Set a custom plate name
{baseDir}/tools/create-3mf.sh model.stl model.3mf --plate-name "Front"

# Use a preset
{baseDir}/tools/create-3mf.sh model.stl model.3mf --preset solid

# Auto-orient for optimal print orientation (e.g. parts with overhangs)
{baseDir}/tools/create-3mf.sh model.stl model.3mf --orient

# Sequential printing (one object at a time)
{baseDir}/tools/create-3mf.sh model.stl model.3mf --by-object

# Custom settings
{baseDir}/tools/create-3mf.sh model.stl model.3mf \
    --setting layer_height=0.12 \
    --setting sparse_infill_density=100% \
    --setting wall_loops=4

# Combine preset + overrides + orient
{baseDir}/tools/create-3mf.sh model.stl model.3mf --preset strong \
    --setting sparse_infill_density=60% --orient

# Use a specific filament profile
{baseDir}/tools/create-3mf.sh model.stl model.3mf --filament bambu-pla-basic

# List available filaments
{baseDir}/tools/create-3mf.sh --list-filaments
```

## Filament Profiles

Filament profiles are stored in `filaments.json` in the project root. The tool searches from the current directory upward to find it.

- The `"default"` key sets which filament is used automatically
- Use `--filament <name>` to override
- Each profile contains BambuStudio filament settings (vendor, density, temperatures, etc.)

### Open in BambuStudio

```bash
{baseDir}/tools/open-bambu.sh model.3mf
```

### Slice via CLI

Slice a 3MF to a `.gcode.3mf` using the patched BambuStudio CLI:

```bash
# Slice — output defaults to model.gcode.3mf
{baseDir}/tools/slice-3mf.sh model.3mf

# Explicit output path
{baseDir}/tools/slice-3mf.sh model.3mf output/model.gcode.3mf

# Auto-orient for optimal print orientation (e.g. drainage inserts)
{baseDir}/tools/slice-3mf.sh model.3mf --orient

# Auto-arrange multiple objects on the plate
{baseDir}/tools/slice-3mf.sh model.3mf --arrange
```

Uses a custom BambuStudio build with CLI fixes. Set `BAMBU_CLI` to override the binary path.

### List Presets & Settings

```bash
{baseDir}/tools/create-3mf.sh --list-presets
{baseDir}/tools/create-3mf.sh --list-settings
```

## Presets

| Preset | Layer | Infill | Walls | Pattern | Use Case |
|--------|-------|--------|-------|---------|----------|
| `default` | 0.2mm | 15% | 3 | gyroid | General purpose |
| `solid` | 0.2mm | 100% | 4 | zig-zag | Washers, spacers, solid functional parts |
| `fast` | 0.28mm | 10% | 2 | gyroid | Quick prototypes, test prints |
| `fine` | 0.12mm | 15% | 3 | gyroid | Visible/decorative parts |
| `strong` | 0.2mm | 40% | 5 | cubic | Load-bearing functional parts |

## Common Settings

Use `--setting key=value` to override any setting. Most useful ones:

### Quality
- `layer_height` — Layer height in mm (0.08–0.28)
- `initial_layer_print_height` — First layer height

### Walls & Shells
- `wall_loops` — Number of perimeters (2–5)
- `top_shell_layers` — Top solid layers (3–7)
- `bottom_shell_layers` — Bottom solid layers (3–7)

### Infill
- `sparse_infill_density` — Infill percentage (0%–100%)
- `sparse_infill_pattern` — gyroid, cubic, zig-zag, honeycomb, rectilinear, concentric, grid

### Support & Adhesion
- `enable_support` — 0=off, 1=on
- `support_type` — normal(auto), tree(auto)
- `brim_type` — auto_brim, brim_outer_only, no_brim
- `brim_width` — Brim width in mm

### Ironing

Ironing smooths top surfaces by making an extra nozzle pass with low flow after printing. The nozzle stays at the same Z height, softening the surface with heat while a small amount of material fills gaps between lines.

**Settings:**
- `ironing_type` — Ironing mode (see types below). Default: `no ironing`
- `ironing_flow` — Extrusion flow during ironing, relative to normal flow. Too low = gaps, too high = blobs. Calibrate per filament.
- `ironing_speed` — Nozzle speed during ironing (mm/s). Slower = smoother but more time + heat creep risk.
- `ironing_pattern` — `zig-zag` (default, recommended) or `concentric`
- `ironing_spacing` — Line spacing in mm (default: `0.15`). Should be smaller than nozzle diameter for overlap.
- `ironing_direction` — Angle relative to top pattern lines. `45`° usually gives best results.
- `ironing_inset` — Distance (mm) between ironing area and edges. Helps avoid material buildup at edges. `0` = disabled.

**Ironing types:**

| Type | 3MF value | Description |
|------|-----------|-------------|
| No ironing | `no ironing` | Off (default) |
| Top surfaces | `top` | Irons all top-facing surfaces at every layer (steps, shelves, intermediate flat areas) |
| Topmost surface | `topmost` | Irons only the highest top surface of the model — best default for most prints |
| All solid layer | `all solid` | Irons every solid layer including internal ones — rarely useful, adds huge time |

**When to use ironing:**
- ✅ Flat top surfaces (lids, signs, nameplates, boxes)
- ❌ Curved top surfaces (ironing can't smooth inter-layer lines on curves)

**Caveats:**
- Adds print time, especially on large top surfaces
- Risk of heat creep at slow speeds with PLA/PETG/TPU
- Model must be well-adhered to build plate (nozzle exerts force during ironing)

**Calibration:** Use the [Ironing Calibration Tool](https://makerworld.com/en/models/1038295-ironing-calibration) to find optimal flow/speed per filament. It prints a 5×5 grid testing speed (20–60 mm/s) × flow (5–25%). Store calibrated values in `filaments.json` per filament profile.

### Printer
- `printer_model` — e.g. "Bambu Lab A1", "Bambu Lab X1 Carbon"
- `curr_bed_type` — "Textured PEI Plate", "Cool Plate", "High Temp Plate"

## Workflow with OpenSCAD Skill

This skill integrates with the OpenSCAD skill for end-to-end model creation:

```bash
# 1. Design in OpenSCAD → STL
.pi/skills/openscad/tools/export-stl.sh model.scad model.stl

# 2. STL → 3MF with print settings (CLI backend, recommended)
.pi/skills/bambu-3mf/tools/create-3mf-cli.sh model.stl model.3mf --preset solid --orient

# 2b. Multiple STLs on one plate, arranged and sliced in one step
.pi/skills/bambu-3mf/tools/create-3mf-cli.sh a.stl b.stl plate.3mf --preset strong --arrange --slice

# 3. Or open in BambuStudio GUI → Slice & Print
.pi/skills/bambu-3mf/tools/open-bambu.sh model.3mf
```

## Settings Template

The base settings template (`settings/base_template.json`) contains ~368 BambuStudio settings including G-code macros, speed profiles, and printer configuration. It was extracted from a working BambuStudio project.

To update the template with your own defaults:
1. Configure your preferred settings in BambuStudio
2. Save the project as 3MF
3. Extract: `unzip -p project.3mf Metadata/project_settings.config > settings/base_template.json`

## How It Works

A BambuStudio 3MF is a ZIP file containing:
- `3D/3dmodel.model` — Mesh data (vertices + triangles) with BambuStudio metadata
- `Metadata/project_settings.config` — Full print settings as JSON (global)
- `Metadata/model_settings.config` — Object placement, plate assignment, and per-plate overrides

### Print Sequence (By Object vs By Layer)

`print_sequence` is a **plate-level** setting stored in `model_settings.config`, NOT in `project_settings.config`. BambuStudio stores it as a `<metadata>` inside the `<plate>` element:

```xml
<plate>
  <metadata key="plater_id" value="1"/>
  <metadata key="print_sequence" value="by object"/>
  ...
</plate>
```

The `print_sequence` key in `project_settings.config` is only the global default (`by layer`). The plate-level value takes precedence. This means the CLI tool's `--setting print_sequence=...` won't work — it would only change the global default, not the plate override. Set print sequence via BambuStudio GUI (Plate Settings dialog) instead.

**Sequential printing constraints (A1):** "By Object" prints each object completely before starting the next. Objects must be spaced far enough apart (front to back) for printhead clearance. Arrange shorter objects in front. Use `--by-object` flag when creating 3MF files.

The key to BambuStudio recognizing the 3MF as its own project is the metadata:
```xml
<metadata name="Application">BambuStudio-02.05.00.66</metadata>
<metadata name="BambuStudio:3mfVersion">1</metadata>
```

This skill uses the official `lib3mf` library for standards-compliant 3MF generation, then adds BambuStudio-proprietary metadata as attachments.

## Custom BambuStudio CLI Build

The CLI tools use a custom BambuStudio build with fixes for macOS CLI mode (stock BambuStudio segfaults — [#4627](https://github.com/bambulab/BambuStudio/issues/4627), [#9636](https://github.com/bambulab/BambuStudio/issues/9636)).

**Build location:** `~/Development/tkoenig/playground/bambustudio/install_dir/bin/BambuStudio.app/Contents/MacOS/BambuStudio`

**Source:** `~/Development/tkoenig/playground/bambustudio/` (cloned from `github.com/bambulab/BambuStudio`)

Set `BAMBU_CLI` env var to override the binary path in any tool.

## Related Skills

- **openscad** (`.pi/skills/openscad/`) — Design `.scad` models and export STLs. See "Workflow with OpenSCAD Skill" above.
- **gridfinity** (`.pi/skills/gridfinity/`) — Gridfinity-specific print settings (layer height, walls, fan overrides) and anti-warp strategies. Load this skill when creating 3MF files for gridfinity baseplates or bins.
