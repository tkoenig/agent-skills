# Agent Skills Repository

This repository contains custom Agent Skills following the [Agent Skills specification](https://agentskills.io/specification).

## Before Creating or Reviewing Skills

**Always fetch and read the specification first:**

```bash
curl https://agentskills.io/specification.md
```

Do this before creating, editing, or validating any skill.

## Agent Behavior Rules

- When installing ClawdHub skills, use the `skill-manager` skill (globally available at `~/.pi/agent/skills/skill-manager/SKILL.md`)
- When listing skills, use the `skill-manager` skill - it has a tool for this
- Do NOT automatically symlink or activate skills - let the user decide
- When adding/removing global skills, always update `config.yml` (used for bootstrapping new machines)
