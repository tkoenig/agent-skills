---
name: obsidian-thok-docs
description: Use when the user asks to document or update personal notes in their Obsidian Thok vault, especially contact lenses, bikes/Orbea Rise, home notes, or when they mention Obsidian. Provides the vault path and direct Markdown workflow.
---

# Obsidian Thok Docs

Use this skill when the user asks to document something in Obsidian or asks about existing personal documentation in the Thok vault.

## Vault

Primary Obsidian vault path:

```text
/Users/tom/Library/Mobile Documents/iCloud~md~obsidian/Documents/Thok
```

Obsidian CLI/binary exists at:

```text
/Applications/Obsidian.app/Contents/MacOS/obsidian
```

But previous sessions found the CLI support unreliable/outdated for listing/updating notes. Prefer editing Markdown files directly on disk.

## Workflow

1. Locate existing notes with `find`/`rg` under the vault.
2. Read the relevant Markdown file before editing.
3. Update via precise `edit` calls, or `write` for new notes.
4. Keep notes human-readable and in German unless the existing note uses another language.
5. Preserve personal data in Obsidian notes, not in this skill.

## Important Notes

- Contact lenses note:
  ```text
  /Users/tom/Library/Mobile Documents/iCloud~md~obsidian/Documents/Thok/Kontaktlinsen.md
  ```
  Read this note for current lens prescriptions, products, prices, and ordering history.

- Orbea Rise note:
  ```text
  /Users/tom/Library/Mobile Documents/iCloud~md~obsidian/Documents/Thok/Bikes/Orbea Rise.md
  ```

- Orbea Rise Bluepaper folder:
  ```text
  /Users/tom/Library/Mobile Documents/iCloud~md~obsidian/Documents/Thok/Bikes/Orbea Rise Bluepaper/
  ```

## Style

For shopping/order documentation, use sections like:

```markdown
## Person

**Product name**

| Parameter | Wert |
|---|---:|
| Packung | 90 Stk. |
| Stärke / PWR | -1,75 |
| Krümmung / BC | 8,5 |
| Durchmesser / DIA | 14,3 |

## Letzte Bestellung / Warenkorb

| Person | Produkt | Menge | Preis |
|---|---|---:|---:|
```

When comparing prices, document the date and source links.
