---
name: real-world-rails
description: Research how production Rails apps solve architectural problems using the Real World Rails repository. Use when the user wants to know how other apps handle something, find patterns, or compare approaches. Triggers on "rails patterns", "how do other apps", "real world rails", "research how apps do".
metadata:
  author: Steve Clarke
  version: "1.1"
---

# Rails Pattern Research

## What This Is

The **Real World Rails** repository is a collection of 200+ production Rails
application source code, included as git submodules. The `apps/` directory
contains the full source of each app — models, migrations, schema,
controllers, views, concerns, gems. The `engines/` directory contains Rails
engines.

## Locating the Repository

Look for a directory called `real-world-rails` with an `apps/` subdirectory.
Check the current working directory first, then
`~/Development/tkoenig/playground/real-world-rails`. If not found, ask the
user where it lives.

## Filtering to Active Projects

**Only research apps that have been actively maintained** — exclude any
project without a commit in the last year. Before searching, run the helper
script to get the list of active apps:

```bash
bash <skill-dir>/scripts/active-apps.sh /path/to/real-world-rails
```

Limit all searches to the directories output by that script. Ignore stale or
abandoned projects — their patterns may be outdated or reflect deprecated
Rails conventions.

## What To Do

The user gives you a topic. Spin up parallel agents to search the **active**
apps for how real codebases implement that pattern. Read actual code — models,
schemas, migrations, associations, validations, query patterns — not just
file names. Synthesize what you find into a clear analysis.

If the user's wording suggests they want help choosing a pattern for their
current project (words like "compare for us", "which fits best",
"adversarial", "debate", "evaluate for our project"), also spin up adversarial
agents that each argue for a different pattern in the context of the current
project's architecture and goals.
