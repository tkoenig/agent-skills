---
name: safari-cli
description: Safari browser automation via AppleScript. Use for navigating, extracting content, running JavaScript, and taking screenshots in Safari on macOS.
---

# Safari CLI

Safari browser automation tools using AppleScript. Works with native macOS Safari.

## Setup

First time setup - enable JavaScript automation:

1. Open Safari
2. Go to Safari > Settings > Advanced
3. Check "Show features for web developers"
4. In Safari menu bar: Develop > Allow JavaScript from Apple Events

Make scripts executable (if needed):
```bash
chmod +x {baseDir}/*.sh
```

**Screenshot dependency**: Requires the `peekaboo` skill. Install with: `brew install steipete/tap/peekaboo`

## Navigate

```bash
{baseDir}/safari-nav.sh https://example.com
{baseDir}/safari-nav.sh https://example.com --new
```

Navigate to URLs. Use `--new` to open in a new tab.

## Evaluate JavaScript

```bash
{baseDir}/safari-eval.sh 'document.title'
{baseDir}/safari-eval.sh 'document.querySelectorAll("a").length'
{baseDir}/safari-eval.sh 'Array.from(document.querySelectorAll("h1")).map(h => h.textContent)'
```

Execute JavaScript in the active tab. Returns the result.

## Screenshot

```bash
{baseDir}/safari-screenshot.sh
```

Capture Safari window as PNG using Peekaboo. Returns the file path. Includes browser chrome (tabs, address bar).

For more screenshot options (Retina, specific windows, etc.), see the `peekaboo` skill.

## Extract Page Content

```bash
{baseDir}/safari-content.sh
{baseDir}/safari-content.sh https://example.com
{baseDir}/safari-content.sh --no-reader https://docs.example.com
```

Extract readable content as markdown. Optionally navigate to URL first.

Uses Safari's native **Reader mode** when available for clean article extraction. Falls back to JavaScript DOM extraction when Reader is unavailable.

**Options:**
- `--no-reader` - Skip Reader mode, use JavaScript extraction instead

**When to use `--no-reader`:**
- Documentation sites (API docs, technical references)
- Pages with code snippets or tables that Reader simplifies too aggressively
- Sites where Reader strips important inline elements

Reader mode works best for articles and blog posts. For technical documentation (e.g., Tailwind CSS docs, MDN), use `--no-reader` to preserve code examples and technical details.

## Tab Management

```bash
{baseDir}/safari-tabs.sh              # List all tabs
{baseDir}/safari-tab.sh 1:3           # Switch to tab 3 of window 1  
{baseDir}/safari-close.sh             # Close current tab
{baseDir}/safari-close.sh 1:2         # Close specific tab
```

## Navigation

```bash
{baseDir}/safari-url.sh               # Get current URL
{baseDir}/safari-back.sh              # Go back
{baseDir}/safari-forward.sh           # Go forward
{baseDir}/safari-reload.sh            # Reload page
```

## Get Page Source

```bash
{baseDir}/safari-source.sh            # Get HTML source
```

## When to Use

- Automating Safari on macOS
- Extracting content from pages requiring JavaScript
- Taking screenshots of web pages
- Managing Safari tabs programmatically
- When you need Safari specifically (vs Chrome/Chromium)

## Troubleshooting

**"JavaScript execution blocked" error:**
- Safari > Develop > Allow JavaScript from Apple Events
- If Develop menu missing: Safari > Settings > Advanced > Show features for web developers

**"No Safari window open" error:**
- Open Safari first, or use `safari-nav.sh` to open a URL

**"Peekaboo not installed" error:**
- Install with: `brew install steipete/tap/peekaboo`
