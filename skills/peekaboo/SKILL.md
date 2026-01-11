---
name: peekaboo
description: macOS screen capture, UI automation, and AI vision. Use for screenshots, clicking, typing, window management, and automating any macOS app.
---

# Peekaboo

macOS CLI for screen capture, UI automation, and AI-powered vision analysis. Works with any application.

## Install

```bash
brew install steipete/tap/peekaboo
```

Requires Screen Recording + Accessibility permissions (System Settings > Privacy & Security).

## Screenshots

```bash
# Capture entire screen
peekaboo image --mode screen --path ~/Desktop/screen.png

# Capture specific app window
peekaboo image --mode window --app Safari --path screenshot.png

# Capture by window ID (for apps with multiple windows)
peekaboo list windows --app Safari    # Find window IDs
peekaboo image --mode window --window-id 12345 --path screenshot.png

# Retina resolution (2x)
peekaboo image --mode screen --retina --path screenshot.png
```

## List Apps/Windows

```bash
peekaboo list apps                    # All running apps
peekaboo list windows                 # All windows
peekaboo list windows --app Safari    # Windows for specific app
peekaboo list screens                 # Available displays
peekaboo list permissions             # Check TCC permissions
```

## Click

```bash
# Click at coordinates
peekaboo click --at 500,300

# Click UI element by label (requires snapshot)
peekaboo see --app Safari --json | jq -r '.data.snapshot_id'
peekaboo click --on "Submit" --snapshot <snapshot_id>

# Right-click
peekaboo click --at 500,300 --button right

# Double-click
peekaboo click --at 500,300 --clicks 2
```

## Type & Keyboard

```bash
# Type text
peekaboo type --text "Hello world"

# Press keys
peekaboo press return
peekaboo press escape
peekaboo press tab

# Keyboard shortcuts
peekaboo hotkey cmd,c              # Copy
peekaboo hotkey cmd,v              # Paste
peekaboo hotkey cmd,shift,t        # Reopen tab
```

## Scroll

```bash
peekaboo scroll --direction down --ticks 5
peekaboo scroll --direction up --ticks 3
```

## Window Management

```bash
peekaboo window list
peekaboo window focus --app Safari
peekaboo window move --app Safari --x 100 --y 100
peekaboo window resize --app Safari --width 1200 --height 800
```

## App Control

```bash
peekaboo app launch Safari
peekaboo app quit Safari
peekaboo app switch Safari
peekaboo app list
```

## Menu Interaction

```bash
peekaboo menu list --app Safari       # List menus
peekaboo menu click --app Safari --menu "File" --item "New Window"
```

## AI Vision (requires API key)

```bash
# Analyze screenshot with AI
peekaboo image --mode screen --analyze "What's on this screen?"

# See command - captures and annotates UI elements
peekaboo see --app Safari --json
```

Configure AI providers:
```bash
export PEEKABOO_AI_PROVIDERS="openai/gpt-4o"
export OPENAI_API_KEY="your-key"
# Or: peekaboo config init
```

## Natural Language Agent

```bash
# Run multi-step automation via natural language
peekaboo agent "Open Notes and create a new note titled TODO"
```

## Common Patterns

### Screenshot of frontmost window
```bash
peekaboo image --mode frontmost --path screenshot.png
```

### Click button in dialog
```bash
peekaboo click --on "OK"
peekaboo click --on "Cancel"
```

### Fill form field
```bash
peekaboo click --at 500,300
peekaboo type --text "my input" --clear
```

### Wait between actions
```bash
peekaboo sleep --duration 1000   # 1 second
```

## JSON Output

Add `--json` or `-j` for machine-readable output:
```bash
peekaboo list windows --app Safari --json
peekaboo see --app Safari --json
```
