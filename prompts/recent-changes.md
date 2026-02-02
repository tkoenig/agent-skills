---
description: Show recent git commits by other team members (excludes your own commits)
---

Show me recent changes made by other team members (not by me).

## Steps

1. Get the current git user name:
   ```bash
   git config user.name
   ```

2. Find the date of your last commit from before today (to determine "since when"):
   ```bash
   git log --author="<current_user>" --before="midnight" --format="%ci" -1
   ```
   
   This gives us the timestamp of your most recent commit before today - i.e., "when you last worked on this".
   
   If no commits found before today, fall back to 7 days ago.

3. Find commits by others since that timestamp:
   ```bash
   git log --since="<timestamp>" --all --no-merges --author="^(?!<current_user>).*$" --perl-regexp --format="%h %an - %s"
   ```

4. For each commit, show the stats:
   ```bash
   git show <commit_hash> --stat
   ```

5. Provide a summary grouped by author, with:
   - Commit message
   - When it was made (relative time)
   - Files changed
   - Brief description of what the change does

## Output format

Start with: "Changes by others since [date] (your last commit before today)"

Group commits by author, then list each with:
- **Commit title** (time ago)
- Files touched
- Brief summary of the change

End with an overall summary of what's been happening.
