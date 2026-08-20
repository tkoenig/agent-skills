# Agent Skills Repository

This repository contains custom Agent Skills following the [Agent Skills specification](https://agentskills.io/specification).

## Before Creating or Reviewing Skills

**Always fetch and read the specification first:**

```bash
curl https://agentskills.io/specification.md
```

Do this before creating, editing, or validating any skill.

## Agent Behavior Rules

- When asked to install a skill, first check if it exists in `skills/` or `github/skills/` in this repo, then use the `skill-manager` skill for GitHub installation
- When listing skills, use the `skill-manager` skill - it has a tool for this
- Do NOT automatically symlink or activate skills - let the user decide
- When adding/removing global skills, always update `config.yml` (used for bootstrapping new machines)
- After finishing a skill or extension change, ask whether to commit and push it unless the user already requested that
- For macOS software changes, use the `macos-software-management` skill and keep dotfiles manifests in sync
