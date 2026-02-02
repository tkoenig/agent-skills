# Agent Skills

Custom skills, prompts, and extensions for [pi-coding-agent](https://github.com/mariozechner/pi-coding-agent).

## Installation

```bash
./bin/sync
```

This syncs skills, prompts, and extensions based on `config.yml` - adds new ones, removes old ones.

## Configuration

Edit `config.yml` to control what's installed globally:

```yaml
# Skills to install globally (~/.pi/agent/skills/)
global_skills:
  - github
  - safari-cli

# Prompts to install globally (~/.pi/agent/prompts/)
global_prompts:
  - commit
  - pr-review

# Extensions to install globally (~/.pi/agent/extensions/)
global_extensions:
  - infra-guard
```

Run `./bin/sync` after changes.

## Per-Project Setup

Symlink skills, prompts, or extensions to any project:

```bash
# Skills
ln -s ~/Development/tkoenig/agent-skills/skills/daisyui .pi/skills/daisyui

# Prompts
ln -s ~/Development/tkoenig/agent-skills/prompts/commit.md .pi/prompts/commit.md

# Extensions
ln -s ~/Development/tkoenig/agent-skills/extensions/infra-guard .pi/extensions/infra-guard
```

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

### safari-cli
Safari browser automation via AppleScript.  
**Setup:** Safari > Develop > Allow JavaScript from Apple Events

### sentry
Sentry error tracking and issue management.

### skill-manager
Manage project-level skills (local only by default).

### slack-assistant
Slack channel monitoring and message posting.

### vscode
VS Code integration for viewing diffs.

### ClawdHub Skills
- `tavily-search` - Web search

## Prompts

### commit
Review and commit staged changes with verification, conventional commits, and optional PR creation.

### pr-review
Structured PR review with issue analysis and code quality checks.

### recent-changes
Show recent git commits by other team members since your last work session.

## Extensions

### infra-guard
Blocks SSH, Ansible, Terraform, rsync, and scp commands to prevent accidental remote server access. These commands should be executed by the user, not the AI agent.
