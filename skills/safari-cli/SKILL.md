---
name: safari-cli
description: Test and debug sites in Safari via the native Safari MCP server (Safari 27 beta or Technology Preview), with AppleScript CLI fallback for stable Safari. Use for Safari-specific browser automation, DOM inspection, network and console debugging, screenshots, and interaction testing on macOS.
---

# Safari CLI

Use native Safari MCP for browser testing and debugging whenever it is available. It gives the agent structured access to the rendered page, DOM interactions, network requests, console messages, and page screenshots. Use the AppleScript scripts below only as a compatibility fallback.

## Tool routing

| Situation | Preferred path |
| --- | --- |
| Safari 27 beta or Safari Technology Preview, debugging/testing | Safari MCP (native `safari_*` tools via pi-mcp-adapter; fallback `scripts/mcp.sh`) |
| DOM interactions, console, network, viewport, media emulation, page screenshots | Safari MCP |
| Stable Safari without `safaridriver --mcp` | AppleScript scripts |
| Readable extraction from an article | `safari-content.sh` |
| Browser-chrome screenshot on stable Safari | `safari-screenshot.sh` |

Before testing a local app, start it and navigate Safari to its local URL. Confirm with the user before any interaction that changes remote state: submitting forms, purchases, destructive actions, or entering sensitive data.

## Safari MCP setup

Safari MCP requires **Safari 27 beta** or **Safari Technology Preview**. It is not supported by older stable Safari releases.

1. Install [Safari 27 beta](https://developer.apple.com/safari/resources/) or [Safari Technology Preview](https://developer.apple.com/safari/technology-preview/).
2. In Safari Settings > Advanced, enable **Show features for web developers**.
3. In Safari Settings > Developer, enable **Allow/Enable remote automation and external agents** (the label varies by build).

### Preferred: pi-mcp-adapter

The server is configured globally in `~/.config/mcp/mcp.json` as `safari` (Safari Technology Preview `safaridriver --mcp`, `lifecycle: "keep-alive"` so tabs, console logs, and network recordings share one browser session across calls). Call tools through the `mcp` proxy tool; `args` is a JSON **string**:

```
mcp({ search: "safari" })                            # discover tools/schemas
mcp({ tool: "safari_navigate_to_url", args: "{\"url\":\"https://example.com\"}" })
mcp({ tool: "safari_evaluate_javascript", args: "{\"script\":\"document.title\"}" })
mcp({ tool: "safari_screenshot", args: "{}" })       # returns a PNG file path, never inline
mcp({ tool: "safari_list_network_requests", args: "{}" })
mcp({ tool: "safari_get_network_request", args: "{\"request_id\":\"...\"}" })
```

Available tools include tab creation/switching/closing, navigation, page information and content extraction, JavaScript evaluation, sequential page interactions, dialogs, console and network inspection, screenshots, viewport sizing, CSS media emulation, and navigation waiting. Run `mcp({ search: "safari <keyword>" })` before calling an unfamiliar tool to verify its parameters.

Safari's MCP server runs locally. Captured page content, screenshots, network data, and console logs are sent to the MCP client/agent, so use it only with trusted agents and pages that do not expose secrets.

### Fallback: mcporter helper

Use only when the native adapter is unavailable. On first use, configure MCPorter with the helper **before** running `status`, `list`, or `call`:

```bash
{baseDir}/scripts/mcp.sh install
{baseDir}/scripts/mcp.sh status
{baseDir}/scripts/mcp.sh list --schema
```

`install` is required once per MCPorter configuration and only registers the local `safaridriver --mcp` command. Do not treat an unregistered-server error from `status` as a Safari MCP failure; run `install` first.

The helper prefers `/usr/bin/safaridriver` when it supports `--mcp`, otherwise Safari Technology Preview. Override the selection with `SAFARI_MCP_DRIVER`. It adds the server as `safari-mcp` to the user-level MCPorter configuration; set `SAFARI_MCP_SCOPE=project` for a project-local config or `SAFARI_MCP_SERVER` to use another name.

Safari tools must share one browser session for tabs, console logs, and network recordings to remain available. The helper automatically opts `safari-mcp` into MCPorter's keep-alive daemon; use the helper for all calls, rather than invoking `mcporter` directly.

### Fallback MCP commands (mcporter)

```bash
{baseDir}/scripts/mcp.sh call navigate_to_url url=https://example.com
{baseDir}/scripts/mcp.sh call evaluate_javascript script='document.title'
{baseDir}/scripts/mcp.sh call list_network_requests
{baseDir}/scripts/mcp.sh call browser_console_messages
{baseDir}/scripts/mcp.sh call screenshot
```

Run `list --schema` before calling an unfamiliar tool to verify its parameters.

MCP screenshots capture the page as PNG and do not require Peekaboo. Prefer `page_interactions` to perform a deliberate sequence of clicks, typing, scrolling, hovering, and key presses; wait for navigation when an interaction should load a new page.

## AppleScript fallback setup

Enable JavaScript automation:

1. Open Safari.
2. Safari > Settings > Advanced > enable **Show features for web developers**.
3. Safari menu bar > Develop > enable **Allow JavaScript from Apple Events**.

Make scripts executable if needed:

```bash
chmod +x {baseDir}/*.sh
```

**Screenshot dependency**: `safari-screenshot.sh` requires Peekaboo. Install with:

```bash
brew install steipete/tap/peekaboo
```

## Navigate

```bash
{baseDir}/safari-nav.sh https://example.com
{baseDir}/safari-nav.sh https://example.com --new
```

Navigate to URLs. Use `--new` to open a new tab.

## Evaluate JavaScript

```bash
{baseDir}/safari-eval.sh 'document.title'
{baseDir}/safari-eval.sh 'document.querySelectorAll("a").length'
{baseDir}/safari-eval.sh 'Array.from(document.querySelectorAll("h1")).map(h => h.textContent)'
```

Executes JavaScript in the active tab and returns the result.

## Screenshot

```bash
{baseDir}/safari-screenshot.sh
```

Captures the Safari window as PNG with Peekaboo, including browser chrome.

## Extract page content

```bash
{baseDir}/safari-content.sh
{baseDir}/safari-content.sh https://example.com
{baseDir}/safari-content.sh --no-reader https://docs.example.com
```

Extracts readable content as Markdown. With a URL, it navigates first. It uses Safari Reader when available and falls back to DOM extraction.

Use `--no-reader` for technical documentation, code snippets, tables, or other pages Reader might oversimplify.

## Tab management

```bash
{baseDir}/safari-tabs.sh              # List all tabs
{baseDir}/safari-tab.sh 1:3           # Switch to tab 3 of window 1
{baseDir}/safari-close.sh             # Close current tab
{baseDir}/safari-close.sh 1:2         # Close specific tab
```

## Navigation helpers

```bash
{baseDir}/safari-url.sh
{baseDir}/safari-back.sh
{baseDir}/safari-forward.sh
{baseDir}/safari-reload.sh
```

## Get page source

```bash
{baseDir}/safari-source.sh
```

## JavaScript console fallback

```bash
{baseDir}/safari-console-install.sh   # Install capture after page load
{baseDir}/safari-console.sh           # Get all captured messages
{baseDir}/safari-console.sh --clear   # Get messages and clear buffer
{baseDir}/safari-console.sh error     # Filter by type
{baseDir}/safari-console.sh --json    # Raw JSON
```

Install console capture after each navigation; it cannot capture messages emitted before installation.

## Troubleshooting

| Error | Resolution |
| --- | --- |
| Safari MCP driver not found | Install Safari 27 beta or Safari Technology Preview. |
| Driver does not support `--mcp` | Use a newer Safari build or AppleScript fallback. |
| MCP remote automation error | Enable remote automation and external agents in Safari Developer settings. |
| AppleScript JavaScript blocked | Enable Develop > Allow JavaScript from Apple Events. |
| No Safari window open | Open Safari or run `safari-nav.sh` with a URL. |
| Peekaboo not installed | Run `brew install steipete/tap/peekaboo`. |
