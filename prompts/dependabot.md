---
description: Review all open Dependabot PRs, research dependency changes, and recommend merge safety
---

Review all open Dependabot PRs for the current GitHub repository and produce a researched merge-safety report.

Optional extra instructions from the user: $@

## 1. Read project conventions

Read `AGENTS.md` or the repo's equivalent agent/contributing guidelines first. Follow all project-specific safety rules, testing guidance, and communication style.

## 2. Identify open Dependabot PRs

Use GitHub CLI. Prefer structured JSON.

Find the repository:

```bash
gh repo view --json nameWithOwner --jq .nameWithOwner
```

List open Dependabot PRs:

```bash
gh pr list --state open --author app/dependabot --json number,title,url,headRefName,baseRefName,createdAt,updatedAt,isDraft,mergeStateStatus,reviewDecision,labels
```

If the repository uses another bot account, also check recent open PRs whose title/body/branch indicates Dependabot, for example branches beginning with `dependabot/`.

If there are no open Dependabot PRs, say so and stop.

## 3. Gather PR details

For each Dependabot PR, read:

```bash
gh pr view <number> --json number,title,body,author,url,headRefName,baseRefName,commits,files,comments,reviews,mergeStateStatus,reviewDecision,statusCheckRollup

gh pr diff <number>
```

Also check CI/check status:

```bash
gh pr checks <number>
```

Do not checkout branches unless needed. If checkout is needed and the working tree is dirty, stop and ask before changing branches.

## 4. Determine exactly what changed

For each PR, identify every dependency update, including grouped PRs.

For each dependency, determine:

- Package/ecosystem: npm, Bundler/RubyGems, GitHub Actions, Docker, etc.
- Current version on `main` / base branch.
- Target version in the PR.
- Direct vs transitive dependency.
- Files changed (`package.json`, `package-lock.json`, `Gemfile.lock`, workflow files, etc.).
- Whether the update is major/minor/patch/pre-release.
- Whether it includes a security fix.

Use the PR diff and lockfiles as the source of truth. Do not rely only on Dependabot's summary.

## 5. Research upstream changes

For each dependency update, research the upstream changes between current and target versions.

Prefer primary sources:

- Official changelog / release notes.
- GitHub releases and tags.
- GitHub compare view between versions.
- Package registry metadata (`npm view`, `gem info`, `bundle info`, GitHub Actions marketplace/repo releases, etc.).
- Migration guides and official docs.
- Security advisories when relevant.

Useful commands/examples:

```bash
# npm
npm view <package> versions --json
npm view <package>@<target> engines dependencies peerDependencies deprecated --json
npm view <package>@<target> repository homepage bugs --json

# RubyGems / Bundler
bundle info <gem>
bundle outdated <gem>

# GitHub repos/releases
gh release list --repo OWNER/REPO --limit 20
gh release view <tag> --repo OWNER/REPO
gh api repos/OWNER/REPO/compare/<old-tag>...<new-tag>
```

If the dependency repository is remote and deeper inspection is useful, use the librarian skill/cache workflow if available.

When web search is needed, search for authoritative sources. Avoid basing conclusions on summaries from unknown third-party sites.

## 6. Look for notable changes

For each dependency, explicitly check for:

- Breaking changes or required migrations.
- Changed supported runtimes (Node/Ruby/Rails/browser versions, OS support).
- New deprecations or removals.
- Security fixes.
- Behavior changes that could affect this app.
- New features that are useful or interesting for this codebase.
- Performance/build/tooling changes.
- Peer dependency or transitive dependency changes.
- Known regressions, open issues, or reverted releases when relevant.

Then inspect this repository for usage of affected APIs/configuration. Use semantic/code search where appropriate.

## 7. Validate merge safety

For each PR, assess:

- CI status and mergeability.
- Version compatibility with this repo's configured runtimes.
- Whether changed package engines conflict with `mise.toml`, CI, or deployment.
- Whether lockfile/package changes are coherent.
- Whether tests/builds should be run locally.
- Whether additional manual smoke checks are needed.

Run local checks only when reasonable for the dependency type and repo guidelines. Examples:

- npm package update: `npm ci`, `npm audit`, relevant build scripts.
- Ruby gem update: `bundle install` check, targeted tests, lint if relevant.
- GitHub Actions update: inspect workflow syntax and action release notes.

Do not perform destructive operations. Follow the repo's database and credential safety rules.

## 8. Output format

Output rendered Markdown. Do not wrap the whole answer in a code fence.

Start with:

# Dependabot PR review

Repository: `owner/repo`
Checked: `<date/time>`

## Summary

A short table:

| PR | Ecosystem | Updates | CI | Risk | Recommendation |
|---|---|---|---|---|---|
| #123 | npm | package A 1.2.3 → 1.2.4 | pass/fail/pending | Low/Medium/High | Merge / Wait / Needs changes / Close |

## PR details

For each PR:

### #123 — Title

- URL: <url>
- Status: open/draft, merge state, CI/checks, review status
- Files changed: brief list

#### Updates

| Package | Current | Target | Type | Direct? |
|---|---:|---:|---|---|

#### Upstream changes researched

Group by package. Include source links.

- **package-name current → target**
  - Breaking changes: ...
  - Security fixes: ...
  - Notable features/fixes: ...
  - Runtime/engine changes: ...
  - Sources: official changelog/release/compare links

If no notable changes are found, say: `No notable upstream changes found beyond routine patch fixes.`

#### App impact

- Where this repo uses the dependency, or why it is only tooling/transitive.
- Any code/config/docs changes suggested.
- Any new feature worth adopting later.

#### Verification

- Checks already green/pending/failing.
- Local commands run, with pass/fail.
- Recommended smoke tests if merged.

#### Recommendation

One of:

- **Merge** — low risk and checks pass.
- **Merge after checks pass** — low risk but CI still pending.
- **Wait** — upstream issue, pre-release, broad major change, or missing info.
- **Needs changes** — package/config/test fixes needed first.
- **Close/superseded** — obsolete or replaced by another PR.

Include a concise reason.

## Follow-ups

List optional improvements discovered while researching dependency updates, separate from merge blockers.
