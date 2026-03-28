#!/usr/bin/env python3
"""Patch BambuStudio 3MF metadata in-place.

Supports:
- setting plate print sequence metadata
- setting explicit plate names
- auto-deriving plate names from the object assigned to each plate
"""

from __future__ import annotations

import argparse
import re
import shutil
import sys
import zipfile
from pathlib import Path
import xml.etree.ElementTree as ET


MODEL_SETTINGS_PATH = "Metadata/model_settings.config"


def normalize_plate_name(value: str | None) -> str:
    if not value:
        return ""
    value = value.strip()
    if not value:
        return ""
    return Path(value).stem.strip()


def parse_plate_names(raw: str | None) -> list[str] | None:
    if raw is None:
        return None
    return [normalize_plate_name(part) for part in raw.split(";")]


def get_metadata_value(parent: ET.Element, key: str) -> str | None:
    for child in parent.findall("metadata"):
        if child.get("key") == key:
            return child.get("value")
    return None


def set_metadata_value(parent: ET.Element, key: str, value: str) -> None:
    for child in parent.findall("metadata"):
        if child.get("key") == key:
            child.set("value", value)
            return
    child = ET.SubElement(parent, "metadata")
    child.set("key", key)
    child.set("value", value)


def derive_object_names(root: ET.Element) -> dict[str, str]:
    names: dict[str, str] = {}
    for obj in root.findall("object"):
        obj_id = obj.get("id")
        if not obj_id:
            continue

        candidates: list[str] = []
        for meta in obj.findall("metadata"):
            if meta.get("key") in {"name", "source_file"}:
                candidates.append(meta.get("value") or "")

        for part in obj.findall("part"):
            for meta in part.findall("metadata"):
                if meta.get("key") in {"name", "source_file"}:
                    candidates.append(meta.get("value") or "")

        normalized = next((name for name in (normalize_plate_name(c) for c in candidates) if name), "")
        names[obj_id] = normalized or f"Object {obj_id}"
    return names


def derive_plate_names(root: ET.Element, output_path: str) -> list[str]:
    plates = root.findall("plate")
    object_names = derive_object_names(root)
    derived_names: list[str] = []
    default_name = normalize_plate_name(Path(output_path).name)

    for index, plate in enumerate(plates, start=1):
        object_ids: list[str] = []
        for instance in plate.findall("model_instance"):
            obj_id = get_metadata_value(instance, "object_id")
            if obj_id:
                object_ids.append(obj_id)

        unique_names: list[str] = []
        for obj_id in object_ids:
            name = object_names.get(obj_id, f"Object {obj_id}")
            if name not in unique_names:
                unique_names.append(name)

        if len(unique_names) == 1:
            derived_names.append(unique_names[0])
            continue

        existing_name = normalize_plate_name(get_metadata_value(plate, "plater_name"))
        if existing_name:
            derived_names.append(existing_name)
            continue

        if len(plates) == 1:
            derived_names.append(default_name or f"Plate {index}")
        else:
            derived_names.append(f"Plate {index}")

    return derived_names


def _regex_set_plate_metadata(plate_text: str, key: str, value: str) -> str:
    """Set a metadata value inside a <plate>...</plate> block using regex.

    Works on raw text without XML parsing — used as a fallback when BambuStudio
    CLI produces invalid XML (e.g. unescaped quotes in G-code macro values).
    """
    pattern = re.compile(
        r'(<metadata\s+key="' + re.escape(key) + r'"\s+value=")([^"]*?)("\s*/>)',
    )
    if pattern.search(plate_text):
        return pattern.sub(r"\g<1>" + value.replace("\\", "\\\\") + r"\3", plate_text)
    # Key not found — insert before closing </plate>
    indent = "    "
    new_meta = f'{indent}<metadata key="{key}" value="{value}"/>\n'
    return plate_text.replace("</plate>", new_meta + "  </plate>")


def _regex_get_plate_object_names(text: str, output_path: str) -> list[str]:
    """Derive plate names from object metadata using regex (fallback)."""
    # Collect object names by id
    object_names: dict[str, str] = {}
    for m in re.finditer(
        r'<object\s+id="(\d+)"[^>]*>.*?</object>', text, re.DOTALL,
    ):
        obj_id = m.group(1)
        name_match = re.search(
            r'<metadata\s+key="(?:name|source_file)"\s+value="([^"]*)"', m.group(0),
        )
        if name_match:
            object_names[obj_id] = normalize_plate_name(name_match.group(1))
        else:
            object_names[obj_id] = f"Object {obj_id}"

    # Find plates and their objects
    plates = list(re.finditer(r"<plate>.*?</plate>", text, re.DOTALL))
    default_name = normalize_plate_name(Path(output_path).name)
    derived: list[str] = []

    for index, pm in enumerate(plates, start=1):
        obj_ids = re.findall(
            r'<metadata\s+key="object_id"\s+value="(\d+)"', pm.group(0),
        )
        unique_names: list[str] = []
        for oid in obj_ids:
            name = object_names.get(oid, f"Object {oid}")
            if name not in unique_names:
                unique_names.append(name)

        if len(unique_names) == 1:
            derived.append(unique_names[0])
        elif len(plates) == 1:
            derived.append(default_name or f"Plate {index}")
        else:
            derived.append(f"Plate {index}")

    return derived


def _patch_with_regex(
    text: str,
    print_sequence: str | None,
    plate_names: list[str] | None,
    auto_plate_names: bool,
    output_path: str,
) -> str:
    """Patch model_settings.config using regex when XML parsing fails."""
    plates = list(re.finditer(r"<plate>.*?</plate>", text, re.DOTALL))

    target_names = plate_names
    if target_names is None and auto_plate_names:
        target_names = _regex_get_plate_object_names(text, output_path)

    if target_names is not None and len(target_names) != len(plates):
        raise RuntimeError(
            f"plate name count mismatch (got {len(target_names)}, expected {len(plates)})"
        )

    # Patch plates in reverse order so offsets remain valid
    for i, pm in reversed(list(enumerate(plates))):
        plate_text = pm.group(0)
        if print_sequence:
            plate_text = _regex_set_plate_metadata(plate_text, "print_sequence", print_sequence)
        if target_names is not None:
            plate_text = _regex_set_plate_metadata(plate_text, "plater_name", target_names[i])
        text = text[: pm.start()] + plate_text + text[pm.end() :]

    return text


def patch_3mf(path: str, print_sequence: str | None, plate_names: list[str] | None, auto_plate_names: bool) -> None:
    tmppath = f"{path}.tmp"

    with zipfile.ZipFile(path, "r") as zin, zipfile.ZipFile(tmppath, "w") as zout:
        if MODEL_SETTINGS_PATH not in zin.namelist():
            raise RuntimeError(f"{path}: missing {MODEL_SETTINGS_PATH}")

        for item in zin.infolist():
            data = zin.read(item.filename)

            if item.filename == MODEL_SETTINGS_PATH:
                xml_text = data.decode("utf-8")
                use_regex = False

                try:
                    root = ET.fromstring(xml_text)
                except ET.ParseError:
                    # BambuStudio CLI can produce invalid XML (unescaped quotes
                    # in G-code macro values like change_filament_gcode).
                    # Fall back to regex-based patching which only touches
                    # <plate> sections and leaves everything else untouched.
                    use_regex = True

                if use_regex:
                    xml_text = _patch_with_regex(
                        xml_text, print_sequence, plate_names, auto_plate_names, path,
                    )
                    data = xml_text.encode("utf-8")
                else:
                    plates = root.findall("plate")

                    if print_sequence:
                        for plate in plates:
                            set_metadata_value(plate, "print_sequence", print_sequence)

                    target_names = plate_names
                    if target_names is None and auto_plate_names:
                        target_names = derive_plate_names(root, path)

                    if target_names is not None:
                        if len(target_names) != len(plates):
                            raise RuntimeError(
                                f"{path}: plate name count mismatch (got {len(target_names)}, expected {len(plates)})"
                            )
                        for plate, name in zip(plates, target_names):
                            set_metadata_value(plate, "plater_name", name)

                    tree = ET.ElementTree(root)
                    ET.indent(tree, space="  ")
                    data = ET.tostring(root, encoding="utf-8", xml_declaration=True)

                item.file_size = len(data)

            zout.writestr(item, data)

    shutil.move(tmppath, path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Patch BambuStudio 3MF metadata in-place")
    parser.add_argument("path", help="Path to .3mf or .gcode.3mf")
    parser.add_argument("--print-sequence", choices=["by layer", "by object"])
    parser.add_argument("--plate-names", help="Semicolon-separated plate names, e.g. 'Front;Back'")
    parser.add_argument(
        "--auto-plate-names",
        action="store_true",
        help="Derive plate names from the object assigned to each plate",
    )
    args = parser.parse_args()

    try:
        patch_3mf(
            args.path,
            print_sequence=args.print_sequence,
            plate_names=parse_plate_names(args.plate_names),
            auto_plate_names=args.auto_plate_names,
        )
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
