---
name: skill-manager
description: Manage and list agent skills, prompts, and extensions - globally (~/.pi/agent/*) or per-project (.pi/*). List, install, link/unlink, and bootstrap setup. Do NOT automatically symlink or activate anything - always let the user decide.
---

# Skill Manager

Manage agent skills, prompts, and extensions for global or project-specific use. Use when the user wants to:
- Install or find skills from the local repository or GitHub
- Link/unlink skills, prompts, or extensions globally or to a project
- List available/installed skills, prompts, and extensions
- Set up project-level `.pi/` configuration

## Finding the Skills Repo

This skill is located at `~/.pi/agent/skills/skill-manager/SKILL.md` (symlinked). Resolve the actual path to find the skills repo:

```bash
SKILL_PATH=$(readlink -f ~/.pi/agent/skills/skill-manager)
AGENT_SKILLS_REPO=$(dirname $(dirname "$SKILL_PATH"))
echo "$AGENT_SKILLS_REPO"
```

## Read Repository Configuration First

Before installing/linking anything, resolve the repo path and read these files with the **read tool** if present:

- `$REPO/README.md`
- `$REPO/config.yml`

This clarifies what is a skill vs prompt vs extension and which global items are expected.

Use this to disambiguate whether the user wants a **skill**, **prompt**, or **extension**.

## List All Skills

Use the `list-skills` tool to get all skills as JSON:

```bash
SKILL_PATH=$(readlink -f ~/.pi/agent/skills/skill-manager)
REPO=$(dirname $(dirname "$SKILL_PATH"))
"$REPO/skills/skill-manager/tools/list-skills"
```

Output is a JSON array with fields: `name`, `source` (local/github), `global` (bool), `local` (bool).

Format as a table for the user:

| Skill | Source | Active |
|-------|--------|--------|
| name | local/github | ✓ (g) / ✓ (l) / ✓ (l)(g) / empty |

- ✓ (g) = globally linked (~/.pi/agent/skills/)
- ✓ (l) = project-linked (.pi/skills/)
- ✓ (l)(g) = both

## List Prompts

List prompts available from the repo:

```bash
SKILL_PATH=$(readlink -f ~/.pi/agent/skills/skill-manager)
REPO=$(dirname $(dirname "$SKILL_PATH"))
find "$REPO/prompts" -maxdepth 1 -name "*.md" -type f
```

Check active global/project prompt links:

```bash
ls -la ~/.pi/agent/prompts
ls -la .pi/prompts
```

## List Extensions

List extensions available from the repo:

```bash
SKILL_PATH=$(readlink -f ~/.pi/agent/skills/skill-manager)
REPO=$(dirname $(dirname "$SKILL_PATH"))
find "$REPO/extensions" -mindepth 1 -maxdepth 1 -type d
```

Check active global/project extension links:

```bash
ls -la ~/.pi/agent/extensions
ls -la .pi/extensions
```

## Disambiguate Request Type (Skill vs Prompt vs Extension)

Before installing:

1. If the user asks for a **prompt** (e.g. "link pr-review"), use `$REPO/prompts/*.md` and prompt link paths.
2. If the user asks for a **skill**, check `$REPO/skills/` and `$REPO/github/skills/` first.
3. If the user asks for an **extension**, use `$REPO/extensions/*` and extension link paths.

If no skill matches, ask for or identify a GitHub skill URL before installing it.

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

After installing, ask whether to link it globally, to the current project, or leave it unlinked:
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

## Linking Skills Globally

Link a skill to make it available in all projects:

```bash
SKILL_PATH=$(readlink -f ~/.pi/agent/skills/skill-manager)
REPO=$(dirname $(dirname "$SKILL_PATH"))

# Link a local skill
ln -sf "$REPO/skills/<skill-name>" ~/.pi/agent/skills/

# Link a GitHub-installed skill
ln -sf "$REPO/github/skills/<skill-name>" ~/.pi/agent/skills/
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

# Link a GitHub-installed skill
ln -sf "$REPO/github/skills/<skill-name>" .pi/skills/
```

## Linking Prompts Globally

Link a prompt to make it available in all projects:

```bash
SKILL_PATH=$(readlink -f ~/.pi/agent/skills/skill-manager)
REPO=$(dirname $(dirname "$SKILL_PATH"))

mkdir -p ~/.pi/agent/prompts
ln -sf "$REPO/prompts/<prompt-name>.md" ~/.pi/agent/prompts/
```

## Unlinking Global Prompts

```bash
rm ~/.pi/agent/prompts/<prompt-name>.md
```

## Linking Prompts to a Project

Create symlinks in the project's `.pi/prompts/` directory:

```bash
SKILL_PATH=$(readlink -f ~/.pi/agent/skills/skill-manager)
REPO=$(dirname $(dirname "$SKILL_PATH"))

mkdir -p .pi/prompts
ln -sf "$REPO/prompts/<prompt-name>.md" .pi/prompts/
```

## Linking Extensions Globally

```bash
SKILL_PATH=$(readlink -f ~/.pi/agent/skills/skill-manager)
REPO=$(dirname $(dirname "$SKILL_PATH"))

mkdir -p ~/.pi/agent/extensions
ln -sf "$REPO/extensions/<extension-name>" ~/.pi/agent/extensions/
```

## Linking Extensions to a Project

```bash
SKILL_PATH=$(readlink -f ~/.pi/agent/skills/skill-manager)
REPO=$(dirname $(dirname "$SKILL_PATH"))

mkdir -p .pi/extensions
ln -sf "$REPO/extensions/<extension-name>" .pi/extensions/
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
4. Suggest relevant skills/prompts/extensions based on findings and repo README/config
5. If no matching installed skill exists, ask for or identify a GitHub skill URL
6. Ask user to confirm before linking/installing
7. Create symlinks for confirmed items

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
- config/database.yml with postgres → no installed skill; ask whether to find/install a GitHub skill

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

After setup, a project can have:
```
project/
└── .pi/
    ├── prompt.md                 # Project instructions (always loaded)
    ├── skills/                   # Project-specific skills
    │   ├── github -> ...         # Symlinked from agent-skills repo
    │   └── custom-skill/
    │       └── SKILL.md
    ├── prompts/                  # Optional project prompts
    │   └── pr-review.md -> ...
    └── extensions/               # Optional project extensions
        └── infra-guard -> ...
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

## Creating Project-Specific Prompts

For prompt templates unique to a project, create them in `.pi/prompts/`:

```markdown
# .pi/prompts/release-checklist.md

Use before cutting a release:
1. Confirm tests pass
2. Confirm changelog entry exists
3. Confirm deployment notes are prepared
```

## Creating Project-Specific Extensions

For project-only extensions, add them in `.pi/extensions/<name>/` and include any required extension files there.
