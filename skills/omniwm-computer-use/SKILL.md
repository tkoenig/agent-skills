---
name: omniwm-computer-use
description: Manage OmniWM windows, Dwindle layouts, workspaces, and shortcuts on macOS. Use for OmniWM configuration or before GUI automation, browser launches, app testing, or moving/focusing Mac windows while OmniWM is running. Preserve the user's focus and layout unless explicitly asked to change them.
compatibility: macOS with OmniWM and its bundled omniwmctl; Python 3 for the optional command wrapper.
metadata:
  reference: https://github.com/nick-s5/omniwm-computer-use
---

# OmniWM for Pi

This is a locally maintained Pi adaptation inspired by the community OmniWM
Computer Use skill, not an automatically updated upstream install. See
[provenance](references/provenance.md). Do not run the upstream Codex installer.

## Discover live state first

Use the CLI bundled with the app to match its IPC protocol:

```sh
CTL=/Applications/OmniWM.app/Contents/MacOS/omniwmctl
"$CTL" ping
"$CTL" query focused-window --format json
"$CTL" query windows --format json
"$CTL" query workspaces --format json
"$CTL" query displays --format json
```

Responses wrap data under `result.payload`; check both process exit status and
JSON `ok`. Window IDs are session-scoped: query again after any app restart.
Select exact windows by bundle ID and, when necessary, title. Never guess among
multiple Ghostty/browser windows. Avoid collecting unrelated window titles.
Use `--help` and `query commands`/`query capabilities` to check current syntax;
the CLI and documented main branch can differ from the installed release.

If IPC is unavailable, check whether OmniWM is running and whether
`[general] ipcEnabled = true` in its settings. Do not enable it without permission,
read its authorization secret, substitute an old CLI, or launch a focus-stealing
app while focus protection is unavailable. Unmanaged windows cannot be protected
using OmniWM's focused-window query.

## Protect focus during automation

Prefer headless, non-activating, or read-only accessibility inspection. Reading
an offscreen window does not require changing focus.

For one synchronous shell action that may activate a GUI, use the helper:

```sh
python3 scripts/with-focus.py -- open -g -a Safari
```

Resolve the helper path relative to this skill directory. It captures the fresh
focused managed window, runs one command, and restores focus in `finally`, even
if the command fails. It refuses to run if focus cannot be captured. It launches
no background guard, does not modify layouts, and preserves the command's exit
status unless restoration fails. It cannot prevent brief activation, a delayed
activation after the child exits, a SIGKILL, or a manual focus change being
superseded at restoration. Keep actions short; never wrap a server or a watcher.
Use Pi's process tool for long-running work rather than starting shell daemons.

For foreground-only GUI tools, capture the exact focused-window ID immediately
before ONE interaction, focus the exact target with `window focus <id>`, perform
the interaction, then restore the captured ID immediately, including on errors.
Re-capture before every later interaction so intervening user changes are honored.
Do not hold a focus lease while waiting for the user.

When the user explicitly requests a focus or layout change, leave the requested
result in place instead of undoing it with the helper.

Before window-creating actions, capture a baseline of window IDs; afterwards
identify only fresh agent-created windows. Close temporary windows through their
owning automation, or ask before leaving them elsewhere. Never move, resize,
close, hide, or scratchpad pre-existing windows for automation convenience.

Before coordinate clicks, query the target display and wait for the COMPLETE
window frame to stabilize over several samples. `isVisible` does not guarantee
full containment. Refresh browser/accessibility state after focus or resizing.
Never resize a user's window merely to make a screenshot or click easier.

## This Mac: Dwindle and shortcuts

The tracked configuration is `omniwm/settings.toml` in the dotfiles repository,
linked at `~/.config/omniwm/settings.toml`. Read its current contents before editing
or sending hotkeys: GUI edits write back and bindings can change. All nine
workspaces were configured for `dwindle`, not Niri. Never run AeroSpace alongside
OmniWM. Do not change macOS privacy permissions or disable SIP.

Configured navigation:

- Command + arrows: focus.
- Command + Shift + arrows: move.
- Command + 1–9: workspace.
- Command + Shift + 1–9: send window to workspace.
- Option + Return: OmniWM fullscreen, not a native macOS Space.
- Option + Shift + O: overview.
- Option + Shift + L: switch the active workspace's layout (can accidentally enable Niri).

For authorized layout changes, prefer explicit CLI commands:

```sh
"$CTL" command set-workspace-layout dwindle
"$CTL" command focus down
"$CTL" command move down
"$CTL" command toggle-split
"$CTL" command preselect down
"$CTL" command switch-workspace 2
```

Dwindle recursively splits a focused tile when a window opens. `preselect down`
controls where the next window goes; it does not move an existing one. Do not use
AeroSpace's `join-with` commands or Niri column commands for a Dwindle workspace.
After any mutation, query the resulting layout and frames rather than assuming
an exit status or keystroke guarantees the desired geometry.

## Configuration changes

Preserve unrelated settings and stable workspace IDs. `general.defaultLayoutType`
is only a fallback; per-workspace `layoutType` overrides it. Change both when
setting the layout everywhere. Use exact edits, validate TOML, then check live
workspace state. Do not replace the full settings file with a partial example:
this release expects a complete schema. Config reloads live; Start at Login is
managed by macOS separately.

Never store the runtime IPC authorization secret, socket, or window-state
catalog in git. Use the macos-software-management skill for install/removal and
update the dotfiles Brewfile first.
