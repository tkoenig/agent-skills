---
name: github
description: "Interact with GitHub using the `gh` CLI. Prefer this skill for any `github.com` repo, file, issue, PR, release, or Actions link. Use `gh repo`, `gh api`, `gh issue`, `gh pr`, and `gh run` to inspect repositories, read files/README/docs, check releases, issues, PRs, and CI runs."
---

# GitHub Skill

Prefer this skill for any `github.com` link when practical, not just issues and PRs. Use the `gh` CLI to inspect repositories, read README/docs/files, check releases, issues, PRs, Actions runs, and make advanced API queries. Always specify `--repo owner/repo` when not in a git directory, or use URLs directly.

## Pull Requests

For PR descriptions, prefer `--body-file` (avoid inline `--body "..."` for markdown with backticks/shell-sensitive characters).

Create PR with a body file:
```bash
gh pr create --title "Your title" --body-file /tmp/pr_body.md
```

Update PR body with a body file:
```bash
gh pr edit 55 --body-file /tmp/pr_body.md --repo owner/repo
```

Check CI status on a PR:
```bash
gh pr checks 55 --repo owner/repo
```

List recent workflow runs:
```bash
gh run list --repo owner/repo --limit 10
```

View a run and see which steps failed:
```bash
gh run view <run-id> --repo owner/repo
```

View logs for failed steps only:
```bash
gh run view <run-id> --repo owner/repo --log-failed
```

## Image and Video Attachments

Prefer native `--attach` (gh v2.99.0+) over gist hosting, release assets, or browser-cookie workarounds. Supported on `gh issue` and `gh pr` commands: `create`, `edit`, and `comment`.

```bash
gh issue create --repo owner/repo --title "Layout bug" \
  --body-file /tmp/issue.md --attach './screenshot.png#Broken layout'
gh pr comment 55 --repo owner/repo --body "Updated screenshots" \
  --attach ./before.png --attach ./after.png
```

- Requires push access to the repository on GitHub.com or GitHub Enterprise Cloud; not GitHub Enterprise Server.
- Images/videos only, not arbitrary files such as logs or ZIPs. Repeat `--attach` for multiple files (up to 50).
- Local Markdown references such as `![Broken layout](./screenshot.png)` are rewritten to uploaded URLs when the matching file is attached. Unreferenced attachments are appended. Existing Markdown alt text takes precedence over `#alt text`; videos do not accept alt text.
- Inspect images for secrets or private information before uploading; confirm the target repository and intended visibility.
- Partial upload failure can still create the issue and print its URL while exiting nonzero. Inspect stdout and the created issue before retrying; repair it rather than creating a duplicate.
- If the flag is unavailable, check `gh --version` and command help; request an upgrade rather than silently using another hosting service. If permissions prevent uploading, explain the limitation and offer the browser flow.

Reference: [Attaching files with GitHub CLI](https://docs.github.com/en/github-cli/github-cli/attaching-files-with-github-cli).

## API for Advanced Queries

The `gh api` command is useful for accessing data not available through other subcommands.

Get PR with specific fields:
```bash
gh api repos/owner/repo/pulls/55 --jq '.title, .state, .user.login'
```

## JSON Output

Most commands support `--json` for structured output.  You can use `--jq` to filter:

```bash
gh issue list --repo owner/repo --json number,title --jq '.[] | "\(.number): \(.title)"'
```
