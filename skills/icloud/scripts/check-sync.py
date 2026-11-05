#!/usr/bin/env python3
"""Read-only, fail-closed iCloud Drive metadata check (Python 3.10+)."""

import argparse
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys

CLOUD = Path.home() / "Library/Mobile Documents/com~apple~CloudDocs"
EXPECTED = {
    "isUploaded": "1",
    "isUploading": "0",
    "isDownloaded": "1",
    "isDownloading": "0",
    "isMostRecentVersionDownloaded": "1",
    "hasUnresolvedConflicts": "0",
    "isSyncPaused": "0",
    "isExcludedFromSync": "0",
    "isTrashed": "0",
}


def parse_status(output):
    values = {}
    for key in EXPECTED:
        matches = re.findall(r"\b" + key + r"\s*=\s*([^;\n]+);", output)
        if len(matches) != 1 or matches[0].strip() not in ("0", "1"):
            return 2, f"Status fehlt oder ist mehrdeutig: {key}"
        values[key] = matches[0].strip()
    differences = [f"{key}={values[key]}" for key in EXPECTED
                   if values[key] != EXPECTED[key]]
    return (1, ", ".join(differences)) if differences else (
        0, "hochgeladen, lokal aktuell, konfliktfrei (Metadaten dieses Macs)")


def inspect(path):
    try:
        result = subprocess.run(
            ["fileproviderctl", "evaluate", str(path)],
            capture_output=True, text=True, timeout=15,
        )
    except (OSError, UnicodeError, subprocess.TimeoutExpired):
        return 2, "fileproviderctl nicht ausführbar oder Zeitlimit überschritten"
    if result.returncode:
        # Never echo raw provider metadata or error output.
        return 2, f"fileproviderctl fehlgeschlagen (Exit {result.returncode})"
    return parse_status(result.stdout + "\n" + result.stderr)


def resolve_target(path, cloud, root=None):
    resolved = Path(path).expanduser().resolve(strict=True)
    if not resolved.is_relative_to(cloud):
        raise ValueError("Ziel liegt außerhalb iCloud Drive")
    if root is not None and not resolved.is_relative_to(root):
        raise ValueError("Ziel liegt außerhalb --root")
    return resolved


def collect(paths, cloud, root=None):
    files, errors = set(), []
    discovered = 0

    def visit(path):
        nonlocal discovered
        try:
            mode = path.lstat().st_mode
            if stat.S_ISLNK(mode):
                errors.append((path, "verschachtelter Symlink nicht verfolgt"))
                return
            # Revalidate containment and identity after directory enumeration.
            if resolve_target(path, cloud, root) != path:
                errors.append((path, "Pfad hat sich während der Prüfung geändert"))
                return
            if stat.S_ISREG(mode):
                files.add(path)
                discovered += 1
            elif stat.S_ISDIR(mode):
                with os.scandir(path) as entries:
                    children = sorted((Path(entry.path) for entry in entries))
                for child in children:
                    visit(child)
            else:
                errors.append((path, "keine reguläre Datei/kein Ordner"))
        except (OSError, RuntimeError, ValueError, RecursionError):
            errors.append((path, "Pfad nicht vollständig lesbar oder außerhalb der Grenzen"))

    for supplied in paths:
        try:
            before = discovered
            error_count = len(errors)
            visit(resolve_target(supplied, cloud, root))
            if discovered == before and len(errors) == error_count:
                errors.append((supplied, "leere Auswahl: keine Dateien prüfbar"))
        except (OSError, RuntimeError, ValueError):
            errors.append((supplied, "Pfad fehlt, ist ungültig oder liegt außerhalb der Grenzen"))
    if not files and not errors:
        errors.append(("Auswahl", "keine Dateien prüfbar"))
    return files, errors


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="iCloud-Dateimetadaten prüfen, ohne Inhalte zu lesen oder Downloads anzustoßen.",
        epilog="Exit: 0=alle OK, 1=abweichender Status, 2=unvollständig/unbekannt. "
               "Keine Bestätigung anderer Geräte; kein Schutz vor gleichzeitigen Änderungen.",
    )
    parser.add_argument("--root", type=Path, help="Erwarteter vorhandener iCloud-Unterordner")
    parser.add_argument("paths", nargs="+", type=Path, help="Explizite Dateien/Ordner; relativ zum Aufruf-CWD")
    args = parser.parse_args(argv)
    if not shutil.which("fileproviderctl"):
        parser.exit(2, "fileproviderctl nicht verfügbar (macOS erforderlich).\n")
    try:
        cloud = CLOUD.resolve(strict=True)
        if not cloud.is_dir():
            raise ValueError("iCloud Drive ist kein Ordner")
        root = resolve_target(args.root, cloud) if args.root is not None else None
        if root is not None and not root.is_dir():
            raise ValueError("--root ist kein Ordner")
    except (OSError, RuntimeError, ValueError):
        parser.exit(2, "iCloud Drive oder --root fehlt/ist ungültig; nichts angelegt.\n")
    files, errors = collect(args.paths, cloud, root)
    code = 2 if errors else 0
    for path, detail in errors:
        print(f"UNBEKANNT  {str(path)!r}: {detail}", file=sys.stderr)
    for path in sorted(files):
        try:
            current = resolve_target(path, cloud, root)
            if current != path or not stat.S_ISREG(path.lstat().st_mode):
                raise ValueError("Pfad geändert")
            status, detail = inspect(path)
        except (OSError, RuntimeError, ValueError):
            status, detail = 2, "Pfad hat sich geändert oder ist nicht mehr verfügbar"
        code = max(code, status)
        print(f"{('OK', 'PRÜFEN', 'UNBEKANNT')[status]:9}  "
              f"{str(path.relative_to(root or cloud))!r}: {detail}")
    return code


if __name__ == "__main__":
    sys.exit(main())
