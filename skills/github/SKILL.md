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
