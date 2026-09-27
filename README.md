# Agent Skills

Custom skills, prompts, subagents, and extensions for [pi-coding-agent](https://github.com/mariozechner/pi-coding-agent).

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

## Subagents

### privacy-auditor
Local-only credential and privacy review with `mlx-core/mlx-community/Qwen3.8-27B-4bit`.
Uses fresh context, only `read`, `grep`, `find`, and `ls`, and explicitly loads the
MLX extension rather than ambient extensions. Returns redacted findings, not values.
Requires `mlx-core` and its downloaded Qwen model. As with `historian`, agents are
linked separately from `bin/sync` (destination must not already exist):

```sh
mkdir -p ~/.pi/agent/agents
ln -s "$PWD/agents/privacy-auditor.md" ~/.pi/agent/agents/privacy-auditor.md
```

```text
/run privacy-auditor "Review only /absolute/path/to/config.json for values that should not be committed. Report locations and categories, never values."
```

Keep launches on the configured local model with fresh context; do not override
the model to a cloud provider or fork a sensitive session. These defaults are not
a security sandbox: runtime/settings overrides can change them, local transcripts
retain tool results, and the parent receives the child's answer. Do not inspect
raw child transcripts with a cloud model. Redaction instructions are not a hard
output filter; use human review or a deterministic redaction step for strict
confidentiality. No sensitive-file audit is run during installation.

### historian
Searches previous Pi sessions to recover decisions, rationale, changes, and unresolved work with source citations. Uses GPT-5.6 Sol with low thinking and fresh context. It searches with the `pi-session-query` helper, then inspects session records directly rather than launching a nested Pi process.

Requires the `pi-subagents` package and access to `openai-codex/gpt-5.6-sol`. The agent is read-only by instruction, not a filesystem sandbox.

Subagents are installed separately from `./bin/sync`. From this repository, link the agent globally (the destination must not already exist):

```bash
mkdir -p ~/.pi/agent/agents
ln -s "$PWD/agents/historian.md" ~/.pi/agent/agents/historian.md
```

The search helper is available at `skills/pi-session-query/tools/session-search`; the agent expects that skill at `~/.pi/agent/skills/pi-session-query`. If it is not linked already, link it with:

```bash
ln -s "$PWD/skills/pi-session-query" ~/.pi/agent/skills/pi-session-query
```

If the helper is unavailable, the agent can fall back to read-only session discovery with `rg` and `find`.

```text
/run historian "Why did we choose fnox in the dotfiles setup?"
```

## Skills

### css-cascade-debugging
Debug CSS override issues involving Tailwind/DaisyUI cascade layers, specificity, `:where()`, generated CSS order, and computed browser styles.

### daisyui
DaisyUI 5 components and Tailwind CSS 4 templates.  
**Requires:** `daisyui-blueprint` MCP

### github
GitHub CLI integration (`gh` for issues, PRs, CI).  
**Install:** `brew install gh`

### grafana-k6-load-testing
Run and analyze Grafana Cloud k6 tests through the CLI and a token-safe, read-only REST API.

### hcloud
Hetzner Cloud management via `hcloud` CLI.  
**Install:** `brew install hcloud`

### hunk-review
Review live Hunk sessions using the skill bundled with the installed CLI. `skills/hunk-review` follows Homebrew's stable Hunk path so skill instructions update with Hunk.

**Install:** `brew install hunk`

### heroku
Manage Heroku apps, dynos, add-ons, config, and restarts via Heroku CLI/API.

### openscad
Create, validate, preview, and export OpenSCAD 3D models for 3D printing.

### safari-cli
Safari browser automation via AppleScript.  
**Setup:** Safari > Develop > Allow JavaScript from Apple Events

### sentry
Sentry error tracking and issue management.

### skill-manager
Manage project-level skills (local only by default).

### slack-assistant
Directory-scoped Slack search, reading, and native unsent drafts via SlackCLI. Routes `~/Development/wearedevs/` and `~/Development/wollzelle/` to explicitly bound workspace profiles. Draft-first; send in Slack or explicitly approve an agent send, including attachments or Block Kit layouts.

**Install:** `brew install shaharia-lab/tap/slackcli` (tracked in dotfiles). See the skill for interactive browser login and workspace binding. Credentials use SlackCLI's private native storage, not fnox.

### unifi
Manage and inspect UniFi Network controllers via `uvx unifi-cli`.

### vscode
VS Code integration for viewing diffs.

## Prompts

### commit
Review and commit staged changes with verification, conventional commits, and optional PR creation.

### dependabot
Review all open Dependabot PRs, research upstream dependency changes, and recommend merge safety.

### pr-review
Structured PR review with issue analysis and code quality checks.

### pr-review-parallel
PR investigation followed by three independent parallel reviews: correctness, tests, and maintainability. Evidence-backed synthesis; review-only.

### recent-changes
Show recent git commits by other team members since your last work session.

### simplify
Simplify the current implementation while preserving behavior.

### wait-what
Re-pitch the previous response with brief context and concise Simplified Technical English.

## Extensions

### mlx-core
Local MLX Core / `mlx-serve` provider, adapting Armin Ronacher's `pi-ds4`
lease, watchdog, and lazy-start approach. Shares downloaded Qwen MLX weights
with the app but owns a separate loopback server. Enabled through `global_extensions`.
See [`extensions/mlx-core/README.md`](extensions/mlx-core/README.md) for usage,
provenance, limitations, and tests.

### infra-guard
Blocks SSH, Ansible, Terraform, rsync, and scp commands to prevent accidental remote server access. These commands should be executed by the user, not the AI agent.

### openai-image-gen
Adds `openai_generate_image` for OpenAI GPT Image generation via OpenCode, ChatGPT subscription login, or OpenAI API credentials.

### current-pr
Non-blocking GitHub PR status footer for pi. Async replacement for `npm:pi-pr-status`; shows PR checks/review threads top-right in the footer.

### rubydex
Adds Rubydex MCP tools via MCPorter for semantic Ruby declaration search, declaration details, descendants, constant references, and per-file declarations.
