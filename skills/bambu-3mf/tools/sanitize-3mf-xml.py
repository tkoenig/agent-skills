#!/usr/bin/env python3
"""Sanitize invalid XML in BambuStudio 3MF model_settings.config.

BambuStudio CLI can produce invalid XML when --load-settings is used,
because G-code macro values (change_filament_gcode, machine_start_gcode, etc.)
contain unescaped &, <, >, " characters in XML attribute values.

This script fixes the XML by properly escaping those characters inside
attribute values, making the file parseable by standard XML parsers.
"""

from __future__ import annotations

import re
import shutil
import sys
import zipfile
from pathlib import Path


MODEL_SETTINGS_PATH = "Metadata/model_settings.config"


def _escape_xml_attr(value: str) -> str:
    """Escape characters that are invalid in XML attribute values."""
    value = value.replace("&", "&amp;")
    value = value.replace("<", "&lt;")
    value = value.replace(">", "&gt;")
    value = value.replace('"', "&quot;")
    return value


def sanitize_model_settings(text: str) -> str:
    """Fix unescaped XML entities in metadata attribute values.

    BambuStudio CLI writes <metadata key="..." value="..."/> lines where
    the value may contain raw &, <, >, or " characters (e.g. G-code macros,
    printer names with quotes). This function processes each line, extracts
    the raw value, escapes it, and rewrites the line.
    """
    lines = text.split("\n")
    result = []

    for line in lines:
        stripped = line.strip()

        # Only process <metadata .../> lines (self-closing)
        if stripped.startswith("<metadata ") and stripped.endswith("/>"):
            line = _fix_metadata_line(line)

        result.append(line)

    return "\n".join(result)


def _fix_metadata_line(line: str) -> str:
    """Fix a single <metadata .../> line by escaping attribute values.

    Strategy: parse the line character by character to correctly identify
    attribute boundaries, since the values themselves may contain unescaped
    quotes that a naive split would mishandle.

    For lines with key="..." value="..." format, we know:
    - The key value is always a clean identifier (no special chars)
    - The value= attribute is the last one before />
    - Everything after 'value="' up to the final '"/>' is the raw value
    """
    # Handle key="..." value="..." pattern
    # Find the value=" attribute — it's always the last substantive attribute
    m = re.match(r'^(\s*<metadata\s+(?:key="[^"]*"\s+)?value=")', line)
    if m:
        prefix = m.group(1)
        rest = line[len(prefix):]

        # Find the closing "/> at the very end (after stripping whitespace)
        rstripped = rest.rstrip()
        if rstripped.endswith('"/>'):
            raw_value = rstripped[:-3]
            trailing_ws = rest[len(rstripped):]
            escaped = _escape_xml_attr(raw_value)
            return prefix + escaped + '"/>' + trailing_ws

    # Handle other metadata patterns like <metadata face_count="..."/>
    # These typically have clean values, but fix them too just in case
    def escape_attr_value(match: re.Match) -> str:
        attr_name = match.group(1)
        value = match.group(2)
        # Only escape if the value contains problematic characters
        if any(c in value for c in '&<>"'):
            value = _escape_xml_attr(value)
        return f'{attr_name}="{value}"'

    # This regex works for simple attributes where value doesn't contain quotes
    return re.sub(r'(\w+)="([^"]*)"', escape_attr_value, line)


def sanitize_3mf(path: str) -> bool:
    """Sanitize model_settings.config inside a 3MF file. Returns True if changes were made."""
    import xml.etree.ElementTree as ET

    tmppath = f"{path}.sanitize.tmp"
    changed = False

    with zipfile.ZipFile(path, "r") as zin:
        if MODEL_SETTINGS_PATH not in zin.namelist():
            return False

        raw = zin.read(MODEL_SETTINGS_PATH).decode("utf-8")

        # Quick check: does it even need fixing?
        try:
            ET.fromstring(raw)
            return False  # Already valid
        except ET.ParseError:
            pass

        fixed = sanitize_model_settings(raw)

        # Verify the fix worked
        try:
            ET.fromstring(fixed)
        except ET.ParseError as e:
            print(f"WARNING: sanitization did not fully fix XML: {e}", file=sys.stderr)

        with zipfile.ZipFile(tmppath, "w") as zout:
            for item in zin.infolist():
                if item.filename == MODEL_SETTINGS_PATH:
                    data = fixed.encode("utf-8")
                    item.file_size = len(data)
                    zout.writestr(item, data)
                else:
                    zout.writestr(item, zin.read(item.filename))

        changed = True

    if changed:
        shutil.move(tmppath, path)

    return changed


def main() -> None:
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <file.3mf>", file=sys.stderr)
        sys.exit(1)

    path = sys.argv[1]
    if not Path(path).exists():
        print(f"ERROR: File not found: {path}", file=sys.stderr)
        sys.exit(1)

    if sanitize_3mf(path):
        print(f"Sanitized XML in {path}")
    else:
        pass  # Already valid, no output needed


if __name__ == "__main__":
    main()
