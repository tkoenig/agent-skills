# Agent Skills

Custom skills for [pi-coding-agent](https://github.com/mariozechner/pi-coding-agent).

## Installation

```bash
./bin/sync
```

This syncs skills based on `config.yml` - adds new ones, removes old ones.

## Configuration

Edit `config.yml` to control which skills are installed globally:

```yaml
# Skills to install globally (~/.pi/agent/skills/)
global_skills:
  - github
  - peekaboo
  # - skill-manager  # commented out = not global

# ClawdHub skills to install and sync
clawdhub_skills:
  - clawdhub
  - tavily-search
```

Run `./bin/install` after changes.

## Per-Project Skills

Ask Pi to set up skills for your project - it will analyze the project and suggest relevant skills to link to `.pi/skills/`.

## Skills

### daisyui
DaisyUI 5 components and Tailwind CSS 4 templates.  
**Requires:** `daisyui-blueprint` MCP

### github
GitHub CLI integration (`gh` for issues, PRs, CI).  
**Install:** `brew install gh`

### hcloud
Hetzner Cloud management via `hcloud` CLI.  
**Install:** `brew install hcloud`

### peekaboo
macOS screenshots, clicks, typing, window management.  
**Install:** `brew install steipete/tap/peekaboo`

### safari-cli
Safari browser automation via AppleScript.  
**Setup:** Safari > Develop > Allow JavaScript from Apple Events

### sentry
Sentry error tracking and issue management.

### skill-manager
Manage project-level skills (local only by default).

### vscode
VS Code integration for viewing diffs.

### ClawdHub Skills
- `clawdhub` - ClawdHub CLI
- `tavily-search` - Web search
- `wienerlinien` - Vienna public transport
