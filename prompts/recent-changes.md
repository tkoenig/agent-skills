---
description: Sync repo and show recent changes (commits, PRs, issues)
---

Sync the repository and show me recent changes — commits by others, merged PRs, and recent issues.

## Steps

### 1. Sync the repository

```bash
git sync
```

This fetches and rebases to get the latest changes.

### 2. Get context

Get the current git user name:
```bash
git config user.name
```

Find the date of your last commit from before today (to determine "since when"):
```bash
git log --author="<current_user>" --before="midnight" --format="%ci" -1
```

If no commits found before today, fall back to 7 days ago. Use this timestamp as `<since>` for all subsequent queries.

### 3. Recent commits by others

Find commits by others since `<since>`:
```bash
git log --since="<since>" --all --no-merges --author="^(?!<current_user>).*$" --perl-regexp --format="%h %an - %s (%cr)"
```

For each commit, show the stats:
```bash
git show <commit_hash> --stat
```

### 4. Recent pull requests

Get all recent PRs (open, merged, closed):
```bash
gh pr list --state all --limit 30 --json number,title,author,state,createdAt,mergedAt,updatedAt,url,isDraft
```

Filter to PRs created or updated since `<since>`. Group them by state (open/draft, merged, closed).

### 5. Recent issues

Show recently updated/created issues:
```bash
gh issue list --state all --limit 15 --json number,title,state,author,createdAt,updatedAt,labels --jq '.[] | "#\(.number) [\(.state)] \(.title) (\(.labels | map(.name) | join(", ")))"'
```

Filter to issues updated since `<since>`.

## Output format

Start with: "**Synced and up to date.** Changes since [date] (your last commit before today):"

### Commits by others

Group commits by author, then list each with:
- **Commit title** (time ago)
- Files touched
- Brief summary of the change

### Merged PRs

List each with:
- **#number: PR title** by author (merged time ago)
- Brief summary

### Open PRs (for review)

List each with:
- **#number: PR title** by author (opened/updated time ago) [draft if applicable]
- Brief summary

### Recent issues

List each with:
- **#number: Issue title** [state] (labels)
- Brief summary

End with an overall summary of what's been happening.
