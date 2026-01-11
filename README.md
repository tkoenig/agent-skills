# Agent Skills

Custom skills for [pi-coding-agent](https://github.com/mariozechner/pi-coding-agent).

## Installation

```bash
./bin/install
```

This symlinks all skills to `~/.pi/agent/skills/` and installs any ClawdHub skills listed in `Clawdfile`.

## ClawdHub Skills

Add skills from [ClawdHub](https://clawdhub.com/) to `Clawdfile`:

```
# ClawdHub skills to install
caldav-calendar
slack
trello
```

Run `./bin/clawdsync` to install/update just ClawdHub skills, or `./bin/install` to sync everything.

## Skills

### daisyui

DaisyUI 5 component snippets, layouts, templates, and theme configuration for Tailwind CSS 4.

- Get component code and examples
- Layout patterns (sidebars, navbars, grids)
- Dashboard and login templates
- Theme configuration for Tailwind 4 + DaisyUI 5

**Requires:** `daisyui-blueprint` MCP via mcporter

### github

GitHub integration via the `gh` CLI.

- Issues and pull requests
- CI workflow runs and logs
- API queries with `gh api`

**Install:** `brew install gh`

### hcloud

Hetzner Cloud infrastructure management via `hcloud` CLI.

- List servers, volumes, networks, firewalls
- Server types and pricing info
- Datacenter and image information

**Install:** `brew install hcloud`  
**Note:** Use read-only API tokens for safety

### peekaboo

macOS screen capture, UI automation, and AI vision using [Peekaboo](https://github.com/steipete/Peekaboo).

- Screenshots (screen, window, app)
- Click, type, scroll automation
- Window and app management
- AI vision analysis

**Install:** `brew install steipete/tap/peekaboo`

### safari-cli

Safari browser automation via AppleScript.

- Navigate to URLs
- Execute JavaScript
- Extract page content as markdown
- Manage tabs
- Screenshots (via peekaboo)

**Setup:** Safari > Develop > Allow JavaScript from Apple Events
