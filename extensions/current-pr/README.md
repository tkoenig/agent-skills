# current-pr

Local replacement/fork of `npm:pi-pr-status`.

What it does:

- Shows the current GitHub PR status in pi.
- Places PR status on the top-right of the footer, above the provider/model line.
- Shows checks and unresolved review-thread count.
- Detects PR URLs in user input and pins them when the current branch has no open PR.

Why this exists:

- The upstream `pi-pr-status` extension uses synchronous `execSync()` calls in input/session/timer handlers.
- This version uses async `pi.exec()` calls only, passes arguments without a shell, and never awaits GitHub network calls from input handlers.
- Polling is skipped while pi is busy, then refreshed when idle.

Commands:

```text
/current-pr refresh      # refresh now
/current-pr clear        # clear a pinned PR URL
/current-pr <PR URL>     # pin a PR URL
/current-pr footer off   # restore pi's default footer; PR status moves to normal status line
/current-pr footer on    # enable top-right footer placement again
```

Requirements:

- `gh` installed and authenticated.
- A GitHub repo checkout.

Activation:

```bash
# Link globally
ln -sfn ~/Development/tkoenig/agent-skills/extensions/current-pr ~/.pi/agent/extensions/current-pr

# Then remove the slow npm package from pi settings
pi remove npm:pi-pr-status

# Reload or restart pi
```
