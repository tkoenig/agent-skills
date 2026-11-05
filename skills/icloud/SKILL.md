---
name: icloud
description: Safely inspect and edit documents stored in iCloud Drive on macOS. Use for iCloud file access, sync checks, placeholders, conflicts, or projects linked to iCloud folders. Includes a read-only local sync checker; does not manage Calendar/EventKit sync.
compatibility: macOS with fileproviderctl and Python 3.10 or newer.
---

# iCloud Drive documents

## Boundaries

- Project instructions own archive paths, document routing and expected roots. Do not assume Bikes, Kinder or any other archive from the working directory.
- Resolve existing project symlinks, preserve them, and verify the resolved target lies in the intended iCloud Drive subtree. Never replace a symlink with a regular file or silently create a missing archive root.
- Work only on the requested files/subtrees. Do not read a whole personal archive to check synchronization.
- This skill covers filesystem documents only. It cannot confirm Calendar/EventKit synchronization or receipt on another device.

## Before reading or editing

Run the bundled checker with explicit paths (resolve the script relative to this skill):

```sh
python3 scripts/check-sync.py --root "/absolute/path/to/expected/iCloud/archive" \
  "/absolute/path/to/document-or-subtree"
```

Paths may also be relative to the command's working directory; `~` is expanded. A project archive symlink can be an argument or `--root`. All resolved targets must be under this Mac's `~/Library/Mobile Documents/com~apple~CloudDocs`, and under `--root` when supplied. The root must already exist as a directory. Prefer `--root` to guard project boundaries.

The checker uses `fileproviderctl evaluate` metadata, does not open document contents, and does not request downloads, repairs, uploads, evictions or other sync mutations. Directory scans include hidden entries. Nested symlinks are reported as unknown, not followed; if intentionally needed, check their explicitly approved target separately. Missing, unreadable, special, or empty explicit selections cannot succeed. Empty subdirectories do not block an otherwise nonempty selection.

- **Exit 0:** every selected regular file reports uploaded, not uploading/downloading, downloaded, latest downloaded version, no unresolved conflicts, not paused/excluded/trashed.
- **Exit 1:** at least one reported flag differs from the expected state.
- **Exit 2:** incomplete check (missing tool/path/flags, ambiguous flags, traversal error, nested symlink, timeout, etc.). Takes precedence over exit 1.

On nonzero results, report the issue and stop before reading unavailable content or editing. Do not bypass the check with Finder, `brctl download`, `fileproviderctl materialize`, or content reads that could hydrate a placeholder. Ask the user to make files available or resolve conflicts and then recheck. Do not repeatedly poll.

## Editing and verification

1. Before the first iCloud edit in each session, check all affected existing documents and the relevant destination subtree. For a new file, check its existing parent; an empty parent yields unknown and needs explicit human confirmation rather than an invented success.
2. Coordinate with other agents/users working in the same subtree. A successful check is a point-in-time observation, not a lock or permission to overwrite intervening changes. Re-read before targeted edits.
3. Make only approved changes. Never resolve conflicts by deleting or overwriting alternatives. Follow project deletion rules; on this Mac deletions go to `/usr/bin/trash`, never permanent deletion commands.
4. After editing, check the affected files again. If upload is pending, report it; do not claim synchronization completed or start a polling loop. Recheck later when requested.
5. Keep output ephemeral. Do not commit private paths, provider metadata, document contents, or raw check reports. Git repositories should generally contain archive pointers/instructions rather than personal originals.

`OK` means only that this Mac's File Provider metadata reported the expected flags at check time. It does not prove server-side consistency, simultaneous-edit safety, or that an iPhone/another Mac has received the file.

## Tests

```sh
python3 -B -m unittest discover -s tests -v
```

Run from this skill directory. Tests use synthetic metadata and temporary directories; no personal documents or live provider are needed.
