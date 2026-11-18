---
name: daisyui
description: Get DaisyUI component snippets, layouts, templates, and theme configuration for Tailwind CSS 4. Use when building or reviewing UI with DaisyUI 5 components.
---

# DaisyUI Blueprint

Retrieve authoritative DaisyUI 5 component syntax, setup guidance, and theme configuration via the daisyUI Blueprint MCP server (Pi server name `daisyui`).

## Access from pi

The server runs through Pi's built-in MCP support, configured in `~/.pi/agent/mcp.json` (email/license injected via fnox profile `daisyui` from the 1Password `Labs` vault item `daisyui License`). Tool names are `mcp__daisyui__<tool>`. Keep the server name short: Claude Code models reject tool names over 50 characters.

- **Main session** (server exposure `codemode`): call from a `codemode` script, e.g. `await tools.mcp__daisyui__daisyui_setup_expert({ workflowId, projectRoot })`. Use `describeTool("mcp__daisyui__<tool>")` for the current schema.
- **Subagents:** add `mcp:daisyui` to the agent's `tools` (background runs); the tools then appear as direct tools (on `claude-code` models with an extra `mcp__pi__` prefix, e.g. `mcp__pi__mcp__daisyui__daisyui_setup_expert`). If they are missing, say so and fall back to the published daisyUI package CSS instead of guessing syntax.

The tool schemas are authoritative; follow each tool's returned `next step` and `structuredContent`.

## Workflow (stateful, ordered)

The server tracks state per `workflowId` (pattern `^[a-z0-9][a-z0-9._-]{0,127}$`). Use one ID per agent and cohesive task, reuse it exactly, and start a new one for parallel agents or design variants.

1. **`daisyui_setup_expert`**: mandatory first. `workflowId`, `projectRoot` (absolute path), plus optional boolean guidance flags (`install`, `config`, `themes`, `colors`, `icons`, `fonts`, `charts`).
2. **`daisyui_rules_enforcer`**: mandatory second. `workflowId` only.
3. **`daisyui_creative_director`**, **`daisyui_page_architect`**: mandatory for a new complete page or screen, optional otherwise, skipped in `convert_*` workflows.
4. **`daisyui_component_syntax_expert`**: mandatory before writing or revising markup. `SnippetIDs` such as `components/button`, `blocks/hero-section`. Returns bounded batches; repeat with the remaining IDs it lists.
5. **`daisyui_quality_inspector`**: read-only check on written files. `auditIntent` (`fix_changes` | `report_only`) and `files` (project-relative paths with line ranges or `changeKind`). Not a replacement for diff/build/test/browser verification.

**Convert workflows** (`convert_figma_to_daisyui`, `convert_screenshot_to_daisyui`, `convert_tailwind_to_daisyui`, `convert_bootstrap_to_daisyui`, `convert_picture_to_theme`) still require setup → rules → component syntax for every component used.

## Reviews

For reviewing DaisyUI changes, `setup_expert` → `rules_enforcer` → `component_syntax_expert` for the components touched gives authoritative class names and structure to compare against. Use `quality_inspector` with `auditIntent: "report_only"`. None of these tools edit files.

## When to Use

- Building or reviewing UI components with DaisyUI
- Need the correct class names and HTML structure
- Setting up Tailwind 4 + DaisyUI 5 themes (`themes: true`)
- Converting Figma/screenshots/Tailwind/Bootstrap markup to DaisyUI
- Auditing written DaisyUI files before finishing a UI task
