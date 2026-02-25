#!/usr/bin/env bash
# Lists apps with at least one commit in the last year.
# Usage: active-apps.sh /path/to/real-world-rails

set -euo pipefail

repo="${1:?Usage: active-apps.sh /path/to/real-world-rails}"
cutoff=$(date -v-1y +%s 2>/dev/null || date -d '1 year ago' +%s)

for dir in "$repo"/apps/*/; do
  [ -d "$dir" ] || continue
  last=$(git -C "$dir" log -1 --format='%ct' 2>/dev/null) || continue
  [ -n "$last" ] && [ "$last" -ge "$cutoff" ] && basename "$dir"
done
