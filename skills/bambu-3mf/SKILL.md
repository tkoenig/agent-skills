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

### Create 3MF

Convert an STL to a BambuStudio-compatible 3MF with print settings:

```bash
# Default settings (0.2mm, 15% gyroid infill, 3 walls)
{baseDir}/tools/create-3mf.sh model.stl model.3mf

# Use a preset
{baseDir}/tools/create-3mf.sh model.stl model.3mf --preset solid

# Custom settings
{baseDir}/tools/create-3mf.sh model.stl model.3mf \
    --setting layer_height=0.12 \
    --setting sparse_infill_density=100% \
    --setting wall_loops=4

# Combine preset + overrides
{baseDir}/tools/create-3mf.sh model.stl model.3mf --preset strong \
    --setting sparse_infill_density=60%
```

### Open in BambuStudio

```bash
{baseDir}/tools/open-bambu.sh model.3mf
```

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

### Printer
- `printer_model` — e.g. "Bambu Lab A1", "Bambu Lab X1 Carbon"
- `curr_bed_type` — "Textured PEI Plate", "Cool Plate", "High Temp Plate"

## Workflow with OpenSCAD Skill

This skill integrates with the OpenSCAD skill for end-to-end model creation:

```bash
# 1. Design in OpenSCAD → STL
.pi/skills/openscad/tools/export-stl.sh model.scad model.stl

# 2. STL → 3MF with print settings
.pi/skills/bambu-3mf/tools/create-3mf.sh model.stl model.3mf --preset solid

# 3. Open in BambuStudio → Slice & Print
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
- `Metadata/project_settings.config` — Full print settings as JSON
- `Metadata/model_settings.config` — Object placement and plate assignment

The key to BambuStudio recognizing the 3MF as its own project is the metadata:
```xml
<metadata name="Application">BambuStudio-02.05.00.66</metadata>
<metadata name="BambuStudio:3mfVersion">1</metadata>
```

This skill uses the official `lib3mf` library for standards-compliant 3MF generation, then adds BambuStudio-proprietary metadata as attachments.
