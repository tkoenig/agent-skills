---
description: Review and commit staged changes with proper verification
---

You are a senior developer preparing to commit staged changes. Follow these steps:

## Verification steps

1. **Check for staged changes**

   - Run `git diff --cached --stat` to show what's staged
   - If nothing is staged, inform the user and stop
   - Show a summary of files changed with additions/deletions

2. **Review the changes**

   - Display the actual diff of staged changes (use `git diff --cached`)
   - Highlight any potential issues:
     - Debugging code (console.log, byebug, binding.pry, debugger, print statements)
     - Commented-out code that should be removed
     - TODO comments that might need addressing
     - Large files or unexpected changes

3. **Check for unstaged changes**

   - Run `git diff --name-status` to check for unstaged changes (do NOT use `git status --short` as the two-column format is easy to misread)
   - Run `git ls-files --others --exclude-standard` to check for untracked files
   - If unstaged or untracked files exist, warn the user:

     ```
     ⚠️  WARNING: You have unstaged changes that will NOT be committed:
     [list of files]

     Do you want to:
     - Continue with only staged changes?
     - Stage additional files first?
     - Cancel?
     ```

4. **Generate commit message**

   - Analyze the changes and propose a clear, concise commit message following conventional commits format:
     - `feat:` for new features
     - `fix:` for bug fixes
     - `refactor:` for code refactoring
     - `style:` for formatting/styling changes
     - `chore:` for maintenance tasks
     - `docs:` for documentation changes
   - Keep the subject line under 72 characters
   - Add a body if the changes need explanation
   - Example:

     ```
     refactor: rename reveal_controller to visibility_controller

     The reveal controller now manages visibility in multiple ways (show, hide,
     toggle, empty), so "visibility" is a more accurate and concise name.

     - Renamed file and updated all references
     - Updated data attributes in all views
     - Updated controller registration
     ```

5. **Show proposed commit** Display:

   ```
   📝 Proposed commit message:
   [commit message]

   📊 Files to be committed:
   [list of staged files with change summary]

   ❓ Should I commit these changes? (yes/no)
   ```

6. **Execute commit**

   - Wait for explicit user confirmation
   - Only proceed if user says "yes", "commit", or similar affirmative response
   - Run `git commit -m "message"` (or `git commit` for multi-line messages)
   - Confirm success and show the commit hash

7. **Post-commit actions** After a successful commit, ask the user:

   a. **Push to origin**

   ```
   🚀 Would you like to push this commit to origin? (yes/no)
   ```

   - If yes, run `git push` (or `git push -u origin <branch>` if no upstream is set)
   - Show the push result

   b. **Check for pull request**

   - After pushing, check if a pull request exists for this branch:
     - Run `gh pr view --json number,title,url 2>&1 || echo "NO_PR"` to check for existing PR
     - If output contains "NO_PR" or error about no pull requests, then no PR exists
   - If NO pull request exists:

     - **MUST RUN** this command to detect the parent branch (do NOT assume main):
       ```bash
       git show-branch | grep '*' | grep -v "$(git rev-parse --abbrev-ref HEAD)" | head -1 | sed 's/.*\[\(.*\)\].*/\1/' | sed 's/[\^~].*//'
       ```
     - This extracts the actual parent branch name (e.g., `feature/parent`, not just `main`)
     - Ask the user:

       ```
       📋 No pull request found for this branch.

       Parent branch detected: [branch-name from command output]

       Would you like to create a pull request? (yes/no)
       ```

     - If yes, run `gh pr create --base [parent-branch] --fill` to create PR with commit messages
     - Show the PR URL after creation

   - If a pull request already exists:
     - Show the PR number and URL from the JSON response

## Important rules

- **NEVER commit without explicit user approval** - this is CRITICAL
- **NEVER push or create PR without explicit user approval**
- Always show the full diff before proposing a commit
- Be thorough in checking for issues
- Make commit messages descriptive and follow conventions
- If in doubt about what to commit, ask the user
- Detect parent branch automatically using git commands before offering to create PR
