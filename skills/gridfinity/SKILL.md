---
name: gridfinity
description: "Gridfinity system knowledge: grid specs, print settings for baseplates and bins, anti-warp strategies, tile splitting for large drawers, and community best practices."
---

# Gridfinity Skill

Design and print Gridfinity-compatible baseplates and bins using the [gridfinity_extended_openscad](https://github.com/ostat/gridfinity_extended_openscad) library. Covers grid specifications, optimal print settings, anti-warp strategies, and tile splitting for large surfaces.

## Grid Specification

| Parameter | Value |
|-----------|-------|
| Grid pitch | 42 × 42 mm |
| Height unit | 7 mm |
| Corner radius | 3.75 mm |
| Magnet diameter | 6.5 mm |
| Screw diameter | 3.0 mm |
| Bin clearance | 0.5 mm per side (built into library) |

## Library: gridfinity_extended_openscad

- **Source:** https://github.com/ostat/gridfinity_extended_openscad
- **Local path:** `../gridfinity_extended_openscad/` (relative to project root)

- **Docs:** https://docs.ostat.com/docs/openscad/gridfinity-extended
- **Requires:** OpenSCAD **developer snapshot** with `manifold` backend and `textmetrics` feature enabled

### Key scripts (top-level)

| Script | Purpose |
|--------|---------|
| `gridfinity_basic_cup.scad` | Standard bins/cups |
| `gridfinity_baseplate.scad` | Baseplates |
| `gridfinity_item_holder.scad` | Custom tool/item holders |
| `gridfinity_tray.scad` | Trays |
| `gridfinity_lid.scad` / `gridfinity_sliding_lid.scad` | Lids |
| `gridfinity_drawers.scad` | Drawers |

### Key modules (for `use` in custom designs)

| Module | Purpose |
|--------|---------|
| `modules/module_gridfinity_cup.scad` | Cup/bin generation |
| `modules/module_gridfinity_baseplate.scad` | Baseplate generation |
| `modules/module_gridfinity_baseplate_common.scad` | Baseplate shared utils (outer dimensions, alignment) |
| `modules/module_gridfinity_frame_connectors.scad` | Seam snap connectors |
| `modules/gridfinity_constants.scad` | Grid pitch, magnet/screw sizes, corner radii |

The `combined/` directory has standalone single-file versions of each script (no `use`/`include` needed).

### Using the library in OpenSCAD

The library path is **relative to the project subdirectory**, not the repo root. From a project like `idasen-grid/`:

```openscad
// Import modules with 'use' (makes modules available without executing top-level code)
use <../../gridfinity_extended_openscad/modules/module_gridfinity_baseplate.scad>
use <../../gridfinity_extended_openscad/modules/module_gridfinity_baseplate_common.scad>

// Import constants with 'include' (executes top-level variable definitions)
include <../../gridfinity_extended_openscad/modules/gridfinity_constants.scad>
```

**Path convention:** Each project lives in its own subdirectory (e.g., `idasen-grid/`), so the library path needs `../../gridfinity_extended_openscad/` (up one to repo root, up one more to parent directory where the library lives).

### Example: Custom baseplate

```openscad
use <../../gridfinity_extended_openscad/modules/module_gridfinity_baseplate.scad>
use <../../gridfinity_extended_openscad/modules/module_gridfinity_baseplate_common.scad>
include <../../gridfinity_extended_openscad/modules/gridfinity_constants.scad>

// Parameters
drawer_width = 325;           // interior mm
drawer_depth = 385;           // interior mm
clearance_per_side = 0.2;     // shrinkage compensation

// Derived
usable_width = drawer_width - 2 * clearance_per_side;
usable_depth = drawer_depth - 2 * clearance_per_side;
grid_cols = floor(usable_width / 42);
grid_rows = floor(usable_depth / 42);

// Render
gridfinity_baseplate(
  num_x = grid_cols,
  num_y = grid_rows,
  outer_num_x = usable_width,
  outer_num_y = usable_depth,
  position_grid_in_outer_x = "center",
  position_grid_in_outer_y = "center"
);
```

### Example: Basic bin

```openscad
use <../../gridfinity_extended_openscad/modules/module_gridfinity_cup.scad>
include <../../gridfinity_extended_openscad/modules/gridfinity_constants.scad>

// 2x1 bin, 3 units high, with label
gridfinity_cup(
  width = 2,          // grid units wide
  depth = 1,          // grid units deep
  num_z = 3,          // height units (×7mm)
  position = "default",
  label_style = "left",
  fingerslide = "default"
);
```

### Key parameters reference

**Baseplates (`gridfinity_baseplate`):**
- `num_x`, `num_y` — grid cells
- `outer_num_x`, `outer_num_y` — total outer dimensions in mm (grid + margins)
- `position_grid_in_outer_x/y` — `"center"`, `"near"`, `"far"` — grid alignment within outer boundary
- `baseplate_style` — `"default"` (weighted), `"efficient"` (cnc-friendly)
- `corner_roles` — `[1,1,1,1]` for rounded corners, `0` for flat (seam edges)
- `seam_connector_snaps` — maps to library's `connectorSnapsStyle`. Values: `"disabled"`, `"smaller"`, `"larger"`

**Cups (`gridfinity_cup`):**
- `width`, `depth` — grid units
- `num_z` — height in 7mm units
- `label_style` — `"disabled"`, `"left"`, `"center"`, `"right"`, `"full"`
- `fingerslide` — `"none"`, `"default"`, `"rounded"`
- `wall_thickness` — wall mm (default from library)
- `num_compartments_x/y` — internal dividers

## Print Settings

### Baseplates (recommended)

Baseplates are flat, functional parts with no cosmetic requirements. Optimize for speed and anti-warp.

```bash
.pi/skills/bambu-3mf/tools/create-3mf-cli.sh \
  baseplate.stl output.3mf \
  --setting layer_height=0.28 \
  --setting wall_loops=2 \
  --setting top_shell_layers=2 \
  --setting bottom_shell_layers=2 \
  --setting sparse_infill_density=10% \
  --setting sparse_infill_pattern=gyroid \
  --setting enable_support=0 \
  --setting brim_type=no_brim \
  --setting close_fan_the_first_x_layers=3 \
  --setting additional_cooling_fan_speed=0
```

| Setting | Value | Rationale |
|---------|-------|-----------|
| Layer height | **0.28 mm** | ~30% faster than 0.2mm; purely functional part, no cosmetic benefit from finer layers |
| Walls | **2** | Sufficient for baseplates; no structural load on perimeters |
| Top/bottom layers | **2 / 2** | At 0.28mm = 0.56mm solid. Enough for thin baseplate geometry; the cavity pattern handles the bottom profile |
| Infill | **10% gyroid** | Sweet spot: 8–15% recommended. Below 8% risks top-layer sag; above 15% wastes material |
| AUX fan | **off (0)** | **Critical for anti-warp.** Large flat PLA parts warp badly with AUX cooling. Community consensus for Bambu printers |
| Close fan first layers | **3** | No part cooling for first 3 layers — helps bed adhesion on large flat surfaces |
| Support | off | Not needed |
| Brim | off | Brim removal is impractical on baseplate geometry |

### Bins (recommended)

Bins have thin walls and need good layer adhesion. Slightly different priorities.

```bash
.pi/skills/bambu-3mf/tools/create-3mf-cli.sh \
  bin.stl output.3mf \
  --setting layer_height=0.24 \
  --setting wall_loops=2 \
  --setting top_shell_layers=3 \
  --setting bottom_shell_layers=2 \
  --setting sparse_infill_density=8% \
  --setting sparse_infill_pattern=gyroid \
  --setting enable_support=0 \
  --setting brim_type=no_brim
```

| Setting | Value | Rationale |
|---------|-------|-----------|
| Layer height | **0.24 mm** | Community sweet spot: ~20% faster than 0.2mm, still clean walls. Use 0.2mm only for cosmetic parts |
| Walls | **2** | 2 is the community minimum and sufficient for standard bins. Use **4** for tall bins (h≥6) to prevent vertical layer separation |
| Top layers | **3** | Enough solid coverage at 0.24mm (0.72mm); 4 layers is overkill for organizer parts |
| Bottom layers | **2** | 2 layers = 0.48mm solid — sufficient for a flat floor; saves material vs 3 |
| Infill | **8% gyroid** | 5–10% is plenty for open-top bins. Below 5% risks top-layer sag; 15% wastes material. Gyroid = good omnidirectional strength |
| Support | off | Not needed for standard bins |
| Brim | off | Difficult to remove from bin geometry |
| AUX fan | default (on) | Fine for small/medium bins. Turn off (`additional_cooling_fan_speed=0`) for tall bins (h≥6) with large wall area |

### What BambuStudio handles automatically (no action needed)

- **Arachne wall generator** (default) — variable-width perimeters that fill gridfinity's thin walls cleanly, better than Classic for this geometry
- **Scarf joint seam** (default in recent versions) — hides seam lines on the curved bin corners automatically
- **Travel / retraction optimisation** — handled per-printer profile
- **Part cooling** — auto-managed; only override AUX fan for tall/large parts (see above)

### Settings rationale (community sources)

- **Layer height:** 0.24mm is the community sweet spot for functional bins — faster than 0.2mm, cleaner than 0.28mm. Use 0.2mm only if surface finish matters. (Source: r/gridfinity, The Next Layer)
- **Walls:** 2 is the community minimum. For taller bins (h≥6), increase to 4 to prevent walls separating vertically — a known failure mode on larger bins. (Source: r/FixMyPrint)
- **Top/bottom layers:** 3 top / 2 bottom at 0.24mm = 0.72mm / 0.48mm solid — well above the functional minimum. 4+ layers is overkill for organizer parts. (Source: The Next Layer)
- **Infill 5–10%:** Below 5%, top layers can sag or warp mid-print. 8% is the safe lower bound. 15% wastes material for open bins with no structural load. (Source: The Next Layer, Portland CNC, r/gridfinity)
- **AUX fan off (tall bins):** The single most impactful anti-warp measure for PLA on Bambu printers. Critical for baseplates and large flat parts; less critical for small bins but recommended for tall ones. (Source: multiple Reddit/forum sources)
- **No cooling first 3 layers:** Standard anti-warp measure. Lets the first layers bond to the bed before cooling contracts them.
- **Temperature:** 220°C for PLA is at the high end but recommended for better layer adhesion, especially with larger nozzles or faster speeds. (Source: The Next Layer, CNC Kitchen)

## Anti-Warp Strategies

Large flat gridfinity parts (baseplates, big bins) are prone to warping. Mitigations in priority order:

1. **AUX fan off** — set `additional_cooling_fan_speed=0`
2. **No cooling first 3 layers** — `close_fan_the_first_x_layers=3`
3. **Textured PEI plate** — good PLA adhesion (our default bed)
4. **Higher nozzle temp** — 220°C helps layer adhesion
5. **Avoid brims** — impractical on gridfinity geometry, use other strategies instead
6. **Split large baseplates into tiles** — reduces flat surface area per tile (see below)

## Tile Splitting for Large Baseplates

When a baseplate exceeds the printer bed (256 × 256 mm on A1), split into tiles:

### When to split

| Dimension | Action |
|-----------|--------|
| Width ≤ 256 mm, Depth ≤ 256 mm | No split needed — single piece |
| Width ≤ 256 mm, Depth > 256 mm | Split depth only → 2 tiles (front/back) |
| Width > 256 mm, Depth ≤ 256 mm | Split width only → 2 tiles (left/right) |
| Width > 256 mm, Depth > 256 mm | Split both → 4 tiles (front-left, front-right, back-left, back-right) |

### How the library handles tiles

The `gridfinity_extended_openscad` library handles multi-tile baseplates natively via these parameters on `gridfinity_baseplate()`:

- **`position_grid_in_outer_x`** / **`position_grid_in_outer_y`**: Set to `"near"` or `"far"` to push the grid to one side, creating a margin on the opposite (outer) side. The library automatically places **snap connectors on seam edges** (no margin) and **smooth borders on outer edges** (margin present).
- **`corner_roles`**: Array of 4 values `[near-x/near-y, near-x/far-y, far-x/near-y, far-x/far-y]`. Set `1` for the outer corner (gets rounded), `0` for seam corners (flat for mating).
- **`seam_connector_snaps`**: Maps to library's `connectorSnapsStyle`. Values: `"disabled"`, `"smaller"`, `"larger"`. `"smaller"` recommended — enough to align tiles without excessive snap force.
- **`seam_connector_clearance`**: Maps to library's `connectorSnapsClearance`. Default `0.2`. Increase to `0.3` if snaps are too tight.

### Tile alignment rules

| Tile position | `position_grid_in_outer_x` | `position_grid_in_outer_y` | `corner_roles` |
|---------------|---------------------------|---------------------------|----------------|
| Front-left | `"far"` (margin left) | `"far"` (margin front) | `[1, 0, 0, 0]` |
| Front-right | `"near"` (margin right) | `"far"` (margin front) | `[0, 0, 1, 0]` |
| Back-left | `"far"` (margin left) | `"near"` (margin back) | `[0, 1, 0, 0]` |
| Back-right | `"near"` (margin right) | `"near"` (margin back) | `[0, 0, 0, 1]` |

The library's `$allowConnectors` mechanism reads the alignment settings to determine which edges are seams:
- Edge with margin → outer edge → no connectors
- Edge without margin → seam edge → snap connectors placed automatically

### Column/row split strategy

Split to keep tile dimensions well under 256mm. For a balanced split:
- **Columns:** Divide roughly in half. E.g., 7 columns → 4 + 3.
- **Rows:** Aim for front tile ≤ 256mm deep. E.g., 9 rows → 5 front + 4 back.

Tile outer dimensions = `(tile_cells × 42) + margin` where margin = `(effective_dimension - grid_cells × 42) / 2`.

### Mixed tiles are compatible

Tiles printed with different settings (layer height, walls, infill) are fully compatible — they mate by snap connectors on the seam edges. Only the grid pitch and outer dimensions matter for fit.

## FDM Tolerances

- Outer dimensions typically shrink **0.2–0.5 mm** in FDM.
- Use `clearance_per_side = 0.2` (default) for drawer fit. Increase to 0.3–0.4 if too tight.
- Snap connector clearance: `connectorSnapsClearance = 0.2` default (mapped as `seam_connector_clearance` in our SCAD files). Adjust ±0.05 if too tight/loose.

## Common Workflow

```bash
# 1. Design baseplate in OpenSCAD (parametric)
#    Set usable_width, usable_depth, clearance_per_side

# 2. Validate
.pi/skills/openscad/tools/validate.sh project/baseplate.scad

# 3. Preview assembly
.pi/skills/openscad/tools/multi-preview.sh project/baseplate.scad project/previews/assembly/ -D 'part="assembly"'

# 4. Export tile STLs
.pi/skills/openscad/tools/export-stl.sh project/baseplate.scad project/tile.stl -D 'part="front_left"'

# 5. Create 3MF with baseplate-optimized settings
.pi/skills/bambu-3mf/tools/create-3mf-cli.sh \
  tile1.stl tile2.stl output.3mf \
  --arrange --plate-names "Tile 1;Tile 2" \
  --setting layer_height=0.28 \
  --setting wall_loops=2 \
  --setting top_shell_layers=2 \
  --setting bottom_shell_layers=2 \
  --setting sparse_infill_density=10% \
  --setting sparse_infill_pattern=gyroid \
  --setting enable_support=0 \
  --setting brim_type=no_brim \
  --setting close_fan_the_first_x_layers=3 \
  --setting additional_cooling_fan_speed=0

# 6. Slice (optional — can also use BambuStudio GUI)
.pi/skills/bambu-3mf/tools/slice-3mf.sh output.3mf
```

## References

- [Gridfinity Extended OpenSCAD docs](https://docs.ostat.com/docs/openscad/gridfinity-extended)
- [Gridfinity Tips & Tricks – The Next Layer](https://thenextlayer.com/gridfinity/) — print settings, infill, layer count, warping
- [Portland CNC – How to use Gridfinity](https://portlandcnc.com/blog/2023/02/gridfinity) — 0.2mm, 8% gyroid baseline
- [r/gridfinity](https://www.reddit.com/r/gridfinity/) — community settings and warping solutions
- [Bambu Lab Wiki – Retraction](https://wiki.bambulab.com/en/software/bambu-studio/parameter/retraction) — travel/retraction optimization
- [Bambu Lab Wiki – Seam Settings](https://wiki.bambulab.com/en/software/bambu-studio/Seam) — seam position and scarf seam
- [Bambu Lab Wiki – Wall Generator](https://wiki.bambulab.com/en/software/bambu-studio/WallGenerator) — Arachne vs Classic, when to switch
- [r/FixMyPrint – Gridfinity walls separating](https://www.reddit.com/r/FixMyPrint/comments/1rhh6s5/gridfinity_walls_vertically_separating_on_larger/) — wall count fix for tall bins

## Related Skills

- **openscad** (`.pi/skills/openscad/`) — Design and validate `.scad` models, generate previews, export STLs. Use this skill for all OpenSCAD operations; the gridfinity skill provides gridfinity-specific parameters and examples.
- **bambu-3mf** (`.pi/skills/bambu-3mf/`) — Create 3MF files with print settings and slice for printing. This skill's print settings section documents the optimal `--setting` overrides for gridfinity parts.
