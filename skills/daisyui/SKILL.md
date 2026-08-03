---
name: daisyui
description: Get DaisyUI component snippets, layouts, templates, and theme configuration for Tailwind CSS 4. Use when building UI with DaisyUI 5 components.
---

# DaisyUI Blueprint

Retrieve authoritative DaisyUI 5 component syntax, setup guidance, and theme configuration via the `daisyui-blueprint` MCP server.

## Calling from pi (pi-mcp-adapter)

The server is configured globally in `~/.config/mcp/mcp.json` (license injected via fnox keychain profile `daisyui`). Call tools through the `mcp` proxy tool; `args` is a JSON **string**:

```
mcp({ tool: "daisyui_blueprint_daisyui_setup_expert", args: "{\"workflowId\":\"my-task\",\"projectRoot\":\"/abs/path\",\"SetupIDs\":[]}" })
mcp({ tool: "daisyui_blueprint_daisyui_rules_enforcer", args: "{\"workflowId\":\"my-task\"}" })
mcp({ tool: "daisyui_blueprint_daisyui_component_syntax_expert", args: "{\"workflowId\":\"my-task\",\"SnippetIDs\":[\"components/button\",\"components/card\"]}" })
```

Discover tool names/schemas on demand with `mcp({ search: "daisyui" })`.

## Workflow (stateful, ordered)

The server tracks per-task state by `workflowId`. Choose one ID per task (pattern `^[a-z0-9][a-z0-9._-]{0,127}$`, one per parallel agent), reuse the exact value across all calls.

1. **`daisyui_blueprint_daisyui_setup_expert`** — MANDATORY first step.
   - `workflowId` (string), `projectRoot` (absolute path, bound to the workflowId once)
   - `SetupIDs` (array, max 6, may be `[]`; enum: `setup/install`, `setup/config`, `setup/themes`, `setup/colors`, `setup/icons`, `setup/fonts`)
2. **`daisyui_blueprint_daisyui_rules_enforcer`** — MANDATORY second. Params: `workflowId` only. Returns the DaisyUI usage rules.
3. Optional: `daisyui_blueprint_daisyui_creative_director`, `daisyui_blueprint_daisyui_page_architect`.
4. **`daisyui_blueprint_daisyui_component_syntax_expert`** — MANDATORY before writing or revising DaisyUI markup.
   - `SnippetIDs` (1–50, enum): ~69 component IDs like `components/button`, plus block IDs like `blocks/hero-section`, `blocks/bento-grid`
   - Returns authoritative markup syntax/snippets. The server validates IDs and reports valid values on error.
5. **`daisyui_blueprint_daisyui_quality_inspector`** — read-only final check on written files.
   - `auditType`: `mcp_changes` | `user_request`
   - `files` (1–300): `{path,startLine,endLine}`, `{path}` (user_request only), or `{path,changeKind:created|replaced|deleted(+anchorLine)}` — project-relative paths
   - Returns a single action: fix-and-rerun, manual_review, report, stop, or finalize. Not a replacement for diff/build/test/browser verification.

**convert_* workflows** (`daisyui_blueprint_convert_figma_to_daisyui`, `..._screenshot_to_daisyui`, `..._tailwind_to_daisyui`, `..._bootstrap_to_daisyui`, `..._picture_to_theme`): skip the optional tools AND the quality inspector, but still require setup_expert → rules_enforcer → component_syntax_expert (with every component ID used).

## Component IDs

IDs are `components/<name>`; common ones:

accordion, alert, avatar, badge, breadcrumbs, button, calendar, card,
carousel, chat, checkbox, collapse, countdown, diff, divider, dock,
drawer, dropdown, fab, fieldset, file-input, filter, footer, hero,
hover-3d, hover-gallery, indicator, input, join, kbd, label, link,
list, loading, mask, menu, mockup-browser, mockup-code, mockup-phone,
mockup-window, modal, navbar, pagination, progress, radial-progress,
radio, range, rating, select, skeleton, stack, stat, status, steps,
swap, tab, table, text-rotate, textarea, theme-controller, timeline,
toast, toggle, validator

**Note:** `tooltip` is missing from the MCP but exists in DaisyUI 5. Use:
```html
<div class="tooltip" data-tip="hello"><button class="btn">Hover</button></div>
<div class="tooltip tooltip-right tooltip-primary" data-tip="info">...</div>
```
Classes: tooltip, tooltip-content, tooltip-top/bottom/left/right, tooltip-open, tooltip-{color}

## When to Use

- Building new UI components with DaisyUI
- Need the correct class names and HTML structure
- Setting up Tailwind 4 + DaisyUI 5 theme configuration (`SetupIDs: ["setup/themes"]`)
- Converting Figma/screenshots/Tailwind/Bootstrap markup to DaisyUI
- Auditing written DaisyUI files before finishing a UI task
