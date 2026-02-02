---
description: Review PRs from URLs with structured issue and code analysis
---

You are given one or more GitHub PR URLs: $@

For each PR URL, do the following in order:

## 1. Read project conventions

Read AGENTS.md (or similar project guidelines file) to understand project-specific guidelines, conventions, and requirements.

## 2. Checkout the PR branch

Checkout the PR branch locally using `gh pr checkout <number>`. This ensures you can read the actual changed files and run tests against the PR code.

If checkout fails due to local changes, stop and ask the user to resolve them before continuing. Do not proceed with the review until the branch is checked out.

## 3. Read the PR

Read the PR page in full using `gh pr view <url> --json title,body,author,comments,reviews,commits,files`.

Include:
- PR description
- All comments and review comments
- All commits
- All changed files

## 4. Identify linked issues

Find any linked issues referenced in:
- PR body
- Comments
- Commit messages
- Cross-links

For each linked issue, read it in full using `gh issue view <number>`, including all comments.

## 5. Analyze the diff

Read the PR diff using `gh pr diff <url>`.

- Read all relevant code files in full with no truncation
- Include related code paths that are NOT in the diff but are required to validate behavior
- Check related test files for the changed code

## 6. Check for test coverage

- Verify that new functionality has corresponding tests
- Check if existing tests need updating for the changes
- Note any missing test coverage

## 7. Validate against project conventions

Review the changes against ALL guidelines in the project's AGENTS.md or conventions file. Pay special attention to:
- Architecture and design patterns specific to the project
- Security considerations
- Code style and conventions
- Framework-specific best practices

Additionally, always check these general quality issues:
- Forms & Accessibility: Are form labels using framework helpers (e.g., `f.label` in Rails, `<Label>` in React) instead of plain `<label>` tags? This ensures proper `for` attribute for accessibility.
- Semantic HTML: Do interactive elements have proper accessibility attributes?
- CSS frameworks: If the project uses a CSS framework (Tailwind, DaisyUI, Bootstrap, etc.), are classes applied correctly per their documentation?

## 8. Provide structured review

Output format:

```
PR: <url>
Title: <title>
Author: <author>

## Good
- Solid choices or improvements

## Bad
- Concrete issues, regressions, missing tests, or risks

## Ugly
- Subtle or high impact problems

## Questions or Assumptions
- Anything unclear that needs clarification

## Change summary
- Brief summary of what the PR does

## Tests
- Status of test coverage
- Suggested additional tests if needed
```

If no issues are found, say so under Bad and Ugly.

## Important notes

- Be thorough but fair - acknowledge good work
- Focus on concrete issues, not style preferences
- All project-specific checks should come from the project's guidelines file - read it carefully
