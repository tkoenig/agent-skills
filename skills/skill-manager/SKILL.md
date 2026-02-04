---
name: skill-manager
description: Manage and list agent skills - both global (~/.pi/agent/skills/) and project-level (.pi/skills/). List all skills, search ClawdHub, install skills, link/unlink skills. Do NOT automatically symlink or activate skills - always let the user decide.
---

# Skill Manager

Manage agent skills for global use or project-specific use. Use when the user wants to:
- Install skills from ClawdHub
- Link/unlink skills globally or to a project
- List available/installed skills
- Search for new skills on ClawdHub
- Set up project-level `.pi/` configuration

## Finding the Skills Repo

This skill is located at `~/.pi/agent/skills/skill-manager/SKILL.md` (symlinked). Resolve the actual path to find the skills repo:

```bash
SKILL_PATH=$(readlink -f ~/.pi/agent/skills/skill-manager)
AGENT_SKILLS_REPO=$(dirname $(dirname "$SKILL_PATH"))
echo "$AGENT_SKILLS_REPO"
```

## List All Skills

Use the `list-skills` tool to get all skills as JSON:

```bash
SKILL_PATH=$(readlink -f ~/.pi/agent/skills/skill-manager)
REPO=$(dirname $(dirname "$SKILL_PATH"))
"$REPO/skills/skill-manager/tools/list-skills"
```

Output is a JSON array with fields: `name`, `source` (local/clawdhub), `global` (bool), `local` (bool).

Format as a table for the user:

| Skill | Source | Active |
|-------|--------|--------|
| name | local/clawdhub | ✓ (g) / ✓ (l) / ✓ (l)(g) / empty |

- ✓ (g) = globally linked (~/.pi/agent/skills/)
- ✓ (l) = project-linked (.pi/skills/)
- ✓ (l)(g) = both

## Search ClawdHub for Skills

Search for skills on ClawdHub by keyword or description:

```bash
clawdhub search "github"
clawdhub search "web scraping"
clawdhub search "database"
```

When the user needs a capability not covered by installed skills, search ClawdHub and suggest relevant results.

## Updating ClawdHub Skills

Update a specific skill to the latest version:

```bash
SKILL_PATH=$(readlink -f ~/.pi/agent/skills/skill-manager)
REPO=$(dirname $(dirname "$SKILL_PATH"))

# Update a specific skill
clawdhub update <skill-name> --workdir "$REPO/clawdhub"

# Update to a specific version
clawdhub update <skill-name> --version 1.2.3 --workdir "$REPO/clawdhub"

# Update all installed skills
clawdhub update --all --workdir "$REPO/clawdhub"

# Force update (skip hash check)
clawdhub update <skill-name> --force --workdir "$REPO/clawdhub"
```

## Installing a ClawdHub Skill

Install a skill from ClawdHub to the repo:

```bash
SKILL_PATH=$(readlink -f ~/.pi/agent/skills/skill-manager)
REPO=$(dirname $(dirname "$SKILL_PATH"))

clawdhub install <skill-slug> --workdir "$REPO/clawdhub"
```

After installing, ask the user if they want to:
1. Link it globally (to `~/.pi/agent/skills/`)
2. Link it to the current project (to `.pi/skills/`)
3. Leave it unlinked for now

## Installing a Skill from GitHub

Install a skill directly from a GitHub repository:

```bash
SKILL_PATH=$(readlink -f ~/.pi/agent/skills/skill-manager)
REPO=$(dirname $(dirname "$SKILL_PATH"))

"$REPO/skills/skill-manager/tools/github-install" <github-url>
```

Supported URL formats:
- `https://github.com/owner/repo/tree/branch/path/to/skill`
- `https://github.com/owner/repo/blob/branch/path/to/skill/SKILL.md`

Example:
```bash
"$REPO/skills/skill-manager/tools/github-install" https://github.com/badlogic/pi-skills/tree/main/browser-tools
```

Skills are installed to `$REPO/github/skills/<skill-name>` and the URL is added to `config.yml` under `github_skills:` for tracking.

After installing, ask the user if they want to link it (same as ClawdHub skills):
```bash
# Link globally
ln -sf "$REPO/github/skills/<skill-name>" ~/.pi/agent/skills/

# Link to project
ln -sf "$REPO/github/skills/<skill-name>" .pi/skills/
```

## Updating GitHub Skills

Update GitHub-installed skills to the latest version (reads URLs from `config.yml`):

```bash
SKILL_PATH=$(readlink -f ~/.pi/agent/skills/skill-manager)
REPO=$(dirname $(dirname "$SKILL_PATH"))

# Update all GitHub-installed skills (default)
"$REPO/skills/skill-manager/tools/github-update"

# Update a specific skill by name
"$REPO/skills/skill-manager/tools/github-update" <skill-name>
```

## Uninstalling a ClawdHub Skill

There is no `clawdhub uninstall` command. To uninstall manually:

```bash
SKILL_PATH=$(readlink -f ~/.pi/agent/skills/skill-manager)
REPO=$(dirname $(dirname "$SKILL_PATH"))

# 1. Remove global symlink if it exists
rm -f ~/.pi/agent/skills/<skill-name>

# 2. Remove project symlink if it exists
rm -f .pi/skills/<skill-name>

# 3. Delete the skill folder
rm -rf "$REPO/clawdhub/skills/<skill-name>"

# 4. Remove from lockfile
# Edit $REPO/clawdhub/.clawdhub/lock.json and remove the skill entry
```

## Linking Skills Globally

Link a skill to make it available in all projects:

```bash
SKILL_PATH=$(readlink -f ~/.pi/agent/skills/skill-manager)
REPO=$(dirname $(dirname "$SKILL_PATH"))

# Link a local skill
ln -sf "$REPO/skills/<skill-name>" ~/.pi/agent/skills/

# Link a ClawdHub skill
ln -sf "$REPO/clawdhub/skills/<skill-name>" ~/.pi/agent/skills/
```

## Unlinking Global Skills

```bash
rm ~/.pi/agent/skills/<skill-name>
```

## Linking Skills to a Project

Create symlinks in the project's `.pi/skills/` directory:

```bash
SKILL_PATH=$(readlink -f ~/.pi/agent/skills/skill-manager)
REPO=$(dirname $(dirname "$SKILL_PATH"))

mkdir -p .pi/skills

# Link a local skill
ln -sf "$REPO/skills/<skill-name>" .pi/skills/

# Link a ClawdHub skill
ln -sf "$REPO/clawdhub/skills/<skill-name>" .pi/skills/
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
5. If no matching installed skill, search ClawdHub: `clawdhub search "<need>"`
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
