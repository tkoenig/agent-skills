---
name: skill-manager
description: Manage pi-coding-agent skills for projects. Link skills, list available skills, search ClawdHub for new skills, set up project-level .pi/ configuration, and suggest relevant skills based on project analysis.
---

# Skill Manager

Manage pi-coding-agent skills for projects. Use when the user wants to:
- Link skills to a project
- List available skills
- Search for new skills on ClawdHub
- Set up project-level `.pi/` configuration

## Finding the Skills Repo

This skill is located at `~/.pi/agent/skills/skill-manager/SKILL.md` (symlinked). Resolve the actual path to find the skills repo:

```bash
SKILL_PATH=$(readlink -f ~/.pi/agent/skills/skill-manager)
AGENT_SKILLS_REPO=$(dirname $(dirname "$SKILL_PATH"))
echo "$AGENT_SKILLS_REPO"
```

## Available Skills (Installed)

```bash
SKILL_PATH=$(readlink -f ~/.pi/agent/skills/skill-manager)
REPO=$(dirname $(dirname "$SKILL_PATH"))

echo "Local skills:"
ls "$REPO/skills/"

echo "ClawdHub skills:"
ls "$REPO/clawdhub/skills/"
```

## Search ClawdHub for Skills

Search for skills on ClawdHub by keyword or description:

```bash
npx clawdhub@latest search "github"
npx clawdhub@latest search "web scraping"
npx clawdhub@latest search "database" --limit 5
```

When the user needs a capability not covered by installed skills, search ClawdHub and suggest relevant results.

## Installing a ClawdHub Skill

To install a skill from ClawdHub, add it to `config.yml` and run sync:

```bash
SKILL_PATH=$(readlink -f ~/.pi/agent/skills/skill-manager)
REPO=$(dirname $(dirname "$SKILL_PATH"))

# Add to clawdhub_skills in config.yml
# Then run:
"$REPO/bin/sync"
```

Or install directly (won't persist across syncs):
```bash
SKILL_PATH=$(readlink -f ~/.pi/agent/skills/skill-manager)
REPO=$(dirname $(dirname "$SKILL_PATH"))

npx clawdhub@latest install <skill-slug> --workdir "$REPO/clawdhub"
```

## Linking Skills to a Project

Create symlinks in the project's `.pi/skills/` directory:

```bash
SKILL_PATH=$(readlink -f ~/.pi/agent/skills/skill-manager)
REPO=$(dirname $(dirname "$SKILL_PATH"))

mkdir -p .pi/skills

# Link a local skill
ln -sf "$REPO/skills/github" .pi/skills/

# Link a ClawdHub skill
ln -sf "$REPO/clawdhub/skills/tavily-search" .pi/skills/
```

## Suggesting Skills for a Project

When setting up skills for a project, analyze it and suggest relevant skills:

| If project has... | Suggest skill |
|-------------------|---------------|
| `.git/` directory | `github` |
| `package.json` with DaisyUI/Tailwind | `daisyui` |
| `Gemfile` with DaisyUI/Tailwind | `daisyui` |
| macOS app or needs screenshots | `peekaboo` |
| Safari automation needed | `safari-cli` |
| Hetzner infrastructure (`hcloud.yml`, etc.) | `hcloud` |
| Sentry (`sentry-ruby`, `@sentry/*` in deps) | `sentry` |
| Needs web search | `tavily-search` |
| Vienna public transport | `wienerlinien` |

### Detecting Project Type

**Node.js/JavaScript:**
- Check `package.json` for dependencies

**Ruby/Rails:**
- Check `Gemfile` for gems
- Look for `config/database.yml`, `config/routes.rb` (Rails indicators)
- Common gems to look for: `sentry-ruby`, `tailwindcss-rails`, `sidekiq`, `redis`, etc.

**Python:**
- Check `requirements.txt`, `pyproject.toml`, `Pipfile`

**Go:**
- Check `go.mod`

**Rust:**
- Check `Cargo.toml`

### Workflow

1. Run `ls -la` and check for `.git/`, `package.json`, `Gemfile`, config files
2. If `package.json` exists, check dependencies
3. If `Gemfile` exists, check gems: `grep -E "gem ['\"]sentry|tailwind" Gemfile`
4. Suggest relevant skills based on findings
5. If no matching installed skill, search ClawdHub: `npx clawdhub@latest search "<need>"`
6. Ask user to confirm before linking/installing
7. Create symlinks for confirmed skills

### Examples

**Node.js project:**
```
I found:
- .git/ → suggest: github
- package.json with tailwindcss, daisyui → suggest: daisyui

Shall I link these skills?
```

**Rails project:**
```
I found:
- .git/ → suggest: github
- Gemfile with sentry-ruby → suggest: sentry
- Gemfile with tailwindcss-rails → suggest: daisyui
- config/database.yml with postgres → no installed skill, searching ClawdHub...

Shall I link github, sentry, daisyui?
```

## Setting Up a Project Prompt

Create `.pi/prompt.md` with project-specific instructions:

```markdown
# Project Name

Brief description of the project.

## Tech Stack
- Language/framework
- Build tools
- Testing approach

## Conventions
- Coding standards
- File organization
- Commit message format

## Common Tasks
- How to run tests
- How to deploy
```

## Directory Structure

After setup, a project should have:
```
project/
└── .pi/
    ├── prompt.md              # Project instructions (always loaded)
    └── skills/                # Project-specific skills
        ├── github -> ...      # Symlinked from agent-skills repo
        └── custom-skill/      # Or project-specific skills
            └── SKILL.md
```

## Creating Project-Specific Skills

For skills unique to a project, create them directly in `.pi/skills/`:

```markdown
# .pi/skills/deploy/SKILL.md

Use when deploying this application.

## Production
1. Run tests: `npm test`
2. Build: `npm run build`
3. Deploy: `./scripts/deploy-prod.sh`
```
