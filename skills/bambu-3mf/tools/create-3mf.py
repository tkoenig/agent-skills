#!/usr/bin/env python3
"""
Create a BambuStudio-compatible 3MF file from an STL with print settings.

Usage:
    python3 create-3mf.py <input.stl> <output.3mf> [--setting key=value ...]

Examples:
    # Basic usage with defaults
    python3 create-3mf.py model.stl model.3mf

    # Custom print settings
    python3 create-3mf.py model.stl model.3mf \
        --setting layer_height=0.12 \
        --setting sparse_infill_density=100% \
        --setting wall_loops=4 \
        --setting enable_support=1

    # Use a preset
    python3 create-3mf.py model.stl model.3mf --preset solid

    # Custom printer
    python3 create-3mf.py model.stl model.3mf \
        --setting "printer_model=Bambu Lab A1" \
        --setting "printer_settings_id=Bambu Lab A1 0.4 nozzle"
"""

import argparse
import json
import os
import struct
import sys

try:
    import lib3mf
except ImportError:
    print("ERROR: lib3mf not installed. Run: pip3 install lib3mf", file=sys.stderr)
    sys.exit(1)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SKILL_DIR = os.path.dirname(SCRIPT_DIR)
SETTINGS_DIR = os.path.join(SKILL_DIR, "settings")

# Built-in presets for common print scenarios
PRESETS = {
    "default": {
        "layer_height": "0.2",
        "initial_layer_print_height": "0.2",
        "wall_loops": "3",
        "top_shell_layers": "4",
        "bottom_shell_layers": "3",
        "sparse_infill_density": "15%",
        "sparse_infill_pattern": "gyroid",
        "enable_support": "0",
        "brim_type": "auto_brim",
    },
    "solid": {
        "layer_height": "0.2",
        "initial_layer_print_height": "0.2",
        "wall_loops": "4",
        "top_shell_layers": "5",
        "bottom_shell_layers": "5",
        "sparse_infill_density": "100%",
        "sparse_infill_pattern": "zig-zag",
        "enable_support": "0",
        "brim_type": "auto_brim",
    },
    "fast": {
        "layer_height": "0.28",
        "initial_layer_print_height": "0.28",
        "wall_loops": "2",
        "top_shell_layers": "3",
        "bottom_shell_layers": "3",
        "sparse_infill_density": "10%",
        "sparse_infill_pattern": "gyroid",
        "enable_support": "0",
        "brim_type": "auto_brim",
    },
    "fine": {
        "layer_height": "0.12",
        "initial_layer_print_height": "0.12",
        "wall_loops": "3",
        "top_shell_layers": "5",
        "bottom_shell_layers": "5",
        "sparse_infill_density": "15%",
        "sparse_infill_pattern": "gyroid",
        "enable_support": "0",
        "brim_type": "auto_brim",
    },
    "strong": {
        "layer_height": "0.2",
        "initial_layer_print_height": "0.2",
        "wall_loops": "5",
        "top_shell_layers": "5",
        "bottom_shell_layers": "5",
        "sparse_infill_density": "40%",
        "sparse_infill_pattern": "cubic",
        "enable_support": "0",
        "brim_type": "auto_brim",
    },
}


def parse_ascii_stl(path):
    """Parse ASCII STL file."""
    with open(path, "r") as f:
        content = f.read()

    vertices = []
    triangles = []
    vertex_map = {}
    current_verts = []

    for line in content.split("\n"):
        line = line.strip()
        if line.startswith("vertex"):
            parts = line.split()
            v = (float(parts[1]), float(parts[2]), float(parts[3]))
            if v not in vertex_map:
                vertex_map[v] = len(vertices)
                vertices.append(v)
            current_verts.append(vertex_map[v])
        elif line.startswith("endfacet"):
            if len(current_verts) == 3:
                triangles.append(tuple(current_verts))
            current_verts = []

    return vertices, triangles


def parse_binary_stl(path):
    """Parse binary STL file."""
    with open(path, "rb") as f:
        f.read(80)  # header
        num_triangles = struct.unpack("<I", f.read(4))[0]

        vertices = []
        triangles = []
        vertex_map = {}

        for _ in range(num_triangles):
            f.read(12)  # normal
            facet_verts = []
            for _ in range(3):
                v = struct.unpack("<3f", f.read(12))
                v_rounded = (round(v[0], 6), round(v[1], 6), round(v[2], 6))
                if v_rounded not in vertex_map:
                    vertex_map[v_rounded] = len(vertices)
                    vertices.append(v_rounded)
                facet_verts.append(vertex_map[v_rounded])
            triangles.append(tuple(facet_verts))
            f.read(2)  # attribute byte count

    return vertices, triangles


def parse_stl(path):
    """Auto-detect and parse STL file (ASCII or binary)."""
    with open(path, "rb") as f:
        header = f.read(80)

    try:
        header_str = header.decode("ascii", errors="strict")
        if header_str.strip().startswith("solid"):
            # Might be ASCII - verify by checking for 'facet'
            with open(path, "r") as f:
                first_lines = f.read(1000)
            if "facet" in first_lines:
                return parse_ascii_stl(path)
    except (UnicodeDecodeError, ValueError):
        pass

    return parse_binary_stl(path)


def load_base_settings():
    """Load base settings template."""
    template_path = os.path.join(SETTINGS_DIR, "base_template.json")
    if not os.path.exists(template_path):
        print(f"WARNING: No base template at {template_path}", file=sys.stderr)
        return {}
    with open(template_path, "r") as f:
        return json.load(f)


def apply_preset(settings, preset_name):
    """Apply a named preset to settings."""
    if preset_name not in PRESETS:
        print(
            f"ERROR: Unknown preset '{preset_name}'. Available: {', '.join(PRESETS.keys())}",
            file=sys.stderr,
        )
        sys.exit(1)

    preset = PRESETS[preset_name]
    for k, v in preset.items():
        settings[k] = v
    return settings


def apply_overrides(settings, overrides):
    """Apply key=value overrides to settings."""
    for override in overrides:
        if "=" not in override:
            print(f"WARNING: Invalid setting format '{override}', expected key=value", file=sys.stderr)
            continue
        key, value = override.split("=", 1)
        settings[key] = value
    return settings


def validate_settings(settings):
    """Check for common setting conflicts and fix them."""
    warnings = []

    density = settings.get("sparse_infill_density", "15%")
    pattern = settings.get("sparse_infill_pattern", "gyroid")

    if density == "100%":
        incompatible_patterns = ["cubic", "gyroid", "honeycomb", "adaptivecubic",
                                  "alignedrectilinear", "3dhoneycomb", "hilbertcurve",
                                  "archimedeanchords", "octagramspiral", "supportcubic",
                                  "lightning"]
        if pattern in incompatible_patterns:
            settings["sparse_infill_pattern"] = "zig-zag"
            warnings.append(
                f"Changed infill pattern from '{pattern}' to 'zig-zag' (required for 100% density)"
            )

    return settings, warnings


def create_3mf(stl_path, output_path, settings):
    """Create a BambuStudio-compatible 3MF file."""
    name = os.path.splitext(os.path.basename(stl_path))[0]

    # Parse STL
    vertices, triangles = parse_stl(stl_path)
    print(f"  Mesh: {len(vertices)} vertices, {len(triangles)} triangles")

    # Calculate bounding box
    xs = [v[0] for v in vertices]
    ys = [v[1] for v in vertices]
    zs = [v[2] for v in vertices]
    size_x = max(xs) - min(xs)
    size_y = max(ys) - min(ys)
    size_z = max(zs) - min(zs)
    print(f"  Size: {size_x:.1f} x {size_y:.1f} x {size_z:.1f} mm")

    # Get bed center from settings
    printable_area = settings.get("printable_area", ["0x0", "256x0", "256x256", "0x256"])
    if printable_area and len(printable_area) >= 3:
        coords = [tuple(map(float, p.split("x"))) for p in printable_area]
        bed_center_x = (min(c[0] for c in coords) + max(c[0] for c in coords)) / 2
        bed_center_y = (min(c[1] for c in coords) + max(c[1] for c in coords)) / 2
    else:
        bed_center_x, bed_center_y = 128.0, 128.0

    # Create 3MF model
    wrapper = lib3mf.Wrapper()
    model = wrapper.CreateModel()
    model.SetUnit(lib3mf.ModelUnit.MilliMeter)

    # Add BambuStudio metadata
    mg = model.GetMetaDataGroup()
    mg.AddMetaData("", "Application", "BambuStudio-02.05.00.66", "xs:string", True)
    mg.AddMetaData("BambuStudio", "BambuStudio:3mfVersion", "1", "xs:string", True)
    mg.AddMetaData("", "Title", name, "xs:string", True)

    # Add mesh object
    mesh = model.AddMeshObject()
    mesh.SetName(name)

    positions = []
    for v in vertices:
        pos = lib3mf.Position()
        pos.Coordinates[0] = v[0]
        pos.Coordinates[1] = v[1]
        pos.Coordinates[2] = v[2]
        positions.append(pos)

    tris = []
    for t in triangles:
        tri = lib3mf.Triangle()
        tri.Indices[0] = t[0]
        tri.Indices[1] = t[1]
        tri.Indices[2] = t[2]
        tris.append(tri)

    mesh.SetGeometry(positions, tris)

    # Place on build plate (centered)
    transform = wrapper.GetTranslationTransform(bed_center_x, bed_center_y, 0.0)
    model.AddBuildItem(mesh, transform)

    # Add project settings
    settings_json = json.dumps(settings, indent=4)
    att = model.AddAttachment("/Metadata/project_settings.config", "")
    att.ReadFromBuffer(settings_json.encode("utf-8"))

    # Add model settings
    obj_id = mesh.GetResourceID()
    model_settings = f'''<?xml version="1.0" encoding="UTF-8"?>
<config>
  <object id="{obj_id}">
    <metadata key="name" value="{name}.stl"/>
    <metadata key="extruder" value="1"/>
    <part id="1" subtype="normal_part">
      <metadata key="name" value="{name}.stl"/>
      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>
    </part>
  </object>
  <plate>
    <metadata key="plater_id" value="1"/>
    <metadata key="plater_name" value=""/>
    <metadata key="locked" value="false"/>
    <model_instance>
      <metadata key="object_id" value="{obj_id}"/>
      <metadata key="instance_id" value="0"/>
      <metadata key="identify_id" value="1"/>
    </model_instance>
  </plate>
</config>'''

    att2 = model.AddAttachment("/Metadata/model_settings.config", "")
    att2.ReadFromBuffer(model_settings.encode("utf-8"))

    # Write 3MF
    writer = model.QueryWriter("3mf")
    writer.WriteToFile(output_path)

    size = os.path.getsize(output_path)
    print(f"  Output: {output_path} ({size:,} bytes)")
    return output_path


def main():
    parser = argparse.ArgumentParser(
        description="Create BambuStudio-compatible 3MF from STL with print settings"
    )
    parser.add_argument("stl", nargs="?", help="Input STL file")
    parser.add_argument("output", nargs="?", help="Output 3MF file")
    parser.add_argument(
        "--preset",
        choices=list(PRESETS.keys()),
        default="default",
        help="Print preset (default: default)",
    )
    parser.add_argument(
        "--setting",
        action="append",
        default=[],
        help="Override setting as key=value (can be repeated)",
    )
    parser.add_argument(
        "--list-presets",
        action="store_true",
        help="List available presets and exit",
    )
    parser.add_argument(
        "--list-settings",
        action="store_true",
        help="List common settings and exit",
    )

    args = parser.parse_args()

    if args.list_presets:
        print("Available presets:")
        for name, preset in PRESETS.items():
            density = preset.get("sparse_infill_density", "?")
            layer = preset.get("layer_height", "?")
            walls = preset.get("wall_loops", "?")
            pattern = preset.get("sparse_infill_pattern", "?")
            print(f"  {name:10s}  layer={layer}mm  infill={density}  walls={walls}  pattern={pattern}")
        return

    if args.list_settings:
        print("Common print settings (use with --setting key=value):")
        print()
        print("  Quality:")
        print("    layer_height          Layer height in mm (0.08-0.28)")
        print("    initial_layer_print_height  First layer height")
        print()
        print("  Walls & Shells:")
        print("    wall_loops            Number of perimeters (2-5)")
        print("    top_shell_layers      Top solid layers (3-7)")
        print("    bottom_shell_layers   Bottom solid layers (3-7)")
        print()
        print("  Infill:")
        print("    sparse_infill_density       Infill density (0%-100%)")
        print("    sparse_infill_pattern       Pattern: gyroid, cubic, zig-zag, honeycomb,")
        print("                                rectilinear, concentric, grid")
        print()
        print("  Support:")
        print("    enable_support        0=off, 1=on")
        print("    support_type          normal(auto), tree(auto)")
        print()
        print("  Adhesion:")
        print("    brim_type             auto_brim, brim_outer_only, no_brim")
        print("    brim_width            Brim width in mm")
        print()
        print("  Printer:")
        print("    printer_model         e.g. 'Bambu Lab A1', 'Bambu Lab X1 Carbon'")
        print("    curr_bed_type         'Textured PEI Plate', 'Cool Plate', 'High Temp Plate'")
        print("    nozzle_diameter       ['0.4'] or ['0.2'], ['0.6'], ['0.8']")
        return

    if not args.stl or not args.output:
        parser.print_usage()
        print("error: stl and output arguments are required", file=sys.stderr)
        sys.exit(2)

    if not os.path.exists(args.stl):
        print(f"ERROR: STL file not found: {args.stl}", file=sys.stderr)
        sys.exit(1)

    print(f"Creating 3MF: {args.stl} → {args.output}")
    print(f"  Preset: {args.preset}")

    # Load base settings
    settings = load_base_settings()

    # Apply preset
    settings = apply_preset(settings, args.preset)

    # Apply manual overrides
    if args.setting:
        settings = apply_overrides(settings, args.setting)
        print(f"  Overrides: {len(args.setting)}")

    # Validate and fix conflicts
    settings, warnings = validate_settings(settings)
    for w in warnings:
        print(f"  ⚠️  {w}")

    # Show key settings
    print(f"  Layer height: {settings.get('layer_height', '?')}mm")
    print(f"  Infill: {settings.get('sparse_infill_density', '?')} ({settings.get('sparse_infill_pattern', '?')})")
    print(f"  Walls: {settings.get('wall_loops', '?')}")
    print(f"  Support: {'on' if settings.get('enable_support') == '1' else 'off'}")

    # Create 3MF
    create_3mf(args.stl, args.output, settings)
    print("✅ Done!")


if __name__ == "__main__":
    main()
