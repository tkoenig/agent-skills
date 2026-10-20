# Provenance and scope

Reference: https://github.com/nick-s5/omniwm-computer-use
Reviewed commit: `f25e50d3b46f0280d0348cfb25dd27d68e3e0970`.

The community skill is linked from OmniWM's CLI documentation. It targets Codex
and emphasizes Niri scrolling workspaces. This local Pi skill applies the same
focus-safety principles, but uses independently written instructions and a small
synchronous Python command wrapper. It does not vendor upstream source code.

Intentional differences:

- Discovered through `~/.pi/agent/skills/`, declared in this repository's
  `config.yml`; no Codex installer or global Codex rule.
- Dwindle guidance and the user's current Command-key shortcuts.
- No detached guard process, `nohup`, polling daemon, temporary focus-state files,
  or automatic permission changes.
- Focus is restored after a bounded command, not continuously enforced. This
  cannot promise zero flicker or prevent delayed app activation. A user's manual
  focus change during the command may be superseded by restoration.
- No unsupported claim that Pi has Codex's Computer Use tool. Use only the GUI,
  accessibility, and browser tools actually available in the current session.

Configuration: https://omniwm.app/config/configuration/
Layouts: https://omniwm.app/guides/layouts/
CLI: https://omniwm.app/reference/cli/overview/

Use the installed CLI's help as the authority when documentation tracks a newer
release. Review changes manually rather than running the GitHub skill updater
against this locally maintained adaptation.
