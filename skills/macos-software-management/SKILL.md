---
name: macos-software-management
description: Manage persistent macOS software installations with Homebrew Bundle, mise, Mac App Store, and fnox. Use whenever installing, removing, or provisioning a Mac app, CLI, runtime, developer tool, or secret-backed tool.
---

# macOS Software Management

Keep installs reproducible in `~/.dotfiles`:

- Formulae, casks, App Store apps: `Brewfile`
- Project/default runtimes: `mise.toml`
- Global versioned tools: `mise/config.toml`
- Secret references: `fnox/config.toml`; values stay in Keychain

## Rules

1. Update the appropriate manifest before installing or removing anything.
2. Install only the requested item directly; use `brew bundle install` only when provisioning the full manifest.
3. Prefer `brew` for macOS packages/apps and `mise` for runtimes or versioned developer tools.
4. Verify cask names and `mas` IDs before editing.
5. Never run `brew bundle cleanup --force` without explicit approval.
6. Never commit secret values.
