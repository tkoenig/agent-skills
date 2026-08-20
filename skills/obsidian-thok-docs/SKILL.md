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

The official Obsidian CLI is enabled and available as:

```text
/opt/homebrew/bin/obsidian
```

It was verified with Obsidian 1.13.7 and the `Thok` vault. Use it for vault-aware listing, search, reading, links, and other Obsidian operations. Direct Markdown edits remain appropriate for precise file changes.

## Workflow

1. Locate notes with `obsidian vault=Thok search query="…"`, or use `find`/`rg` on disk.
2. Read with `obsidian vault=Thok read path="…"` or the `read` tool before editing.
3. Use Obsidian CLI commands when vault semantics matter; otherwise use precise `edit` calls or `write` for new notes.
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
