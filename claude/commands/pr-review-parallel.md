---
description: Review GitHub PRs with four native Claude Code reviewers and shared Pi guidance
argument-hint: "<PR-URL> [additional PR URLs or focus]"
---

Review these GitHub PRs: $ARGUMENTS

This invocation explicitly authorizes the four read-only reviewer tasks below, using Claude Code's native subagents. It does not authorize further delegation, source edits, fixes, commits, pushes, merges, or publishing GitHub comments/reviews.

## Shared review contract

Read `~/.pi/agent/prompts/pr-review-parallel.md` in full. Use its four review angles, target investigation, stable checkout requirements, skill routing, evidence/finding contract, validation ownership, and final Markdown report format. Treat its `$@` placeholder as the PR arguments above, not a shell expression.

The shared prompt is the source of truth for review policy. The following Claude-specific orchestration replaces its Pi orchestration requirements; do not execute both workflows. If the shared prompt is missing or unreadable, stop and report that dependency rather than inventing a replacement.

## Claude-native orchestration

- Use Claude Code's native Agent/subagent tool, not Pi, pi-subagents, an external CLI reviewer, or agent teams. Do not load the pi-subagents skill or call its discovery/workflow APIs.
- Read `~/.pi/agent/AGENTS.md` when present, repository ancestor/root instructions, and applicable nested `AGENTS.md` files. Apply normal Claude instructions too; stop on material conflicts instead of silently dropping a safety rule.
- Discover shared skills in `~/.pi/agent/skills/` and the target repository's `.pi/skills/`, plus available Claude skills. Follow symlinks to read their actual `SKILL.md` files; resolve supporting files relative to the skill directory.
- Assign relevant skill paths and reasons explicitly in each reviewer brief. Shared Markdown guidance is available by reading files, not by assuming Pi's skill loader exists here.
- Pi tools, codemode, MCP connections, and authentication are not inherited. Use available Claude-native equivalents only when they provide the required capability. Do not install skills, change configuration, copy credentials, or assume a missing tool's check passed. Report blockers and skipped checks.
- Launch exactly four independent native subagents concurrently, one per shared review angle. Use a general-purpose subagent capable of direct source inspection and permitted validation. Give every reviewer a self-contained brief with pinned refs, instructions and skill paths, objective, evidence contract, and validation owners. Do not pass another reviewer's conclusions or the coordinator's preferred verdict.
- Reviewers must read instructions, assigned skills, complete relevant source, and the pinned diff themselves. They may not delegate further, change checkout, edit source, or publish. Read-only is an authority boundary, not a claim that general-purpose tools provide a sandbox.
- Name one browser-validation owner and one stateful-test owner. Normal permitted tests/browser checks are allowed only under the project's safety rules; no production or restricted operations. Keep other reviewers to non-competing inspection.
- Keep one stable checkout while reviewers run. Process multiple PRs sequentially. Do not change branches while any reviewer is active.
- Wait for all four results using native completion handling. Do not poll terminals or start substitute reviewers. If launch or validation fails, report the affected reviewer, cwd/ref, error, partial state, and confidence limitation; ask before changing the execution protocol.
- Recheck findings, resolve disagreements, and synthesize exactly as required by the shared review contract. Do not claim a complete review if a reviewer is missing.

## Interactive handoff

This session may have been opened by Pi through Rex. Keep progress legible: announce the pinned head, reviewer dispatch, blockers, and final completion. Respond normally to follow-up user messages; they may be relayed through Rex.

Keep the final review in this terminal. Do not create report files in the repository by default. If the user explicitly requests a report file, use the exact approved path and do not overwrite an existing file without confirmation. Never infer permission to fix or publish from a request to discuss a finding.
