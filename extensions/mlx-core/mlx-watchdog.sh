#!/bin/sh
# Adapted from Armin Ronacher's pi-ds4; MIT, see LICENSE and UPSTREAM.md.
set -u

managed_by="pi-mlx-core-provider"
mlx_dir=${1:-${MLX_DIR:-}}

if [ -z "$mlx_dir" ]; then
  echo "mlx-watchdog: missing mlx directory" >&2
  exit 0
fi

client_dir=${MLX_CLIENT_DIR:-$mlx_dir/clients}
state_file=${MLX_STATE_FILE:-$mlx_dir/server.json}
log_file=${MLX_LOG_FILE:-$mlx_dir/log}
base_url=${MLX_BASE_URL:-}
port=${MLX_PORT:-}
lease_ttl_s=${MLX_LEASE_TTL_S:-45}
poll_s=${MLX_WATCHDOG_POLL_S:-2}
shutdown_grace_s=${MLX_SHUTDOWN_GRACE_S:-60}

log() {
  mkdir -p "$mlx_dir" 2>/dev/null || true
  printf '[%s] mlx-watchdog: %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >> "$log_file" 2>/dev/null || true
}

pid_alive() {
  [ -n "${1:-}" ] && kill -0 "$1" 2>/dev/null
}

mtime_sec() {
  # GNU stat (Linux) first: `stat -f` there means --file-system and prints
  # non-numeric output while exiting 0, so a BSD-first order never falls
  # through. BSD/macOS stat lacks -c and falls through to -f %m.
  stat -c %Y "$1" 2>/dev/null || stat -f %m "$1" 2>/dev/null || echo 0
}

process_args() {
  ps -p "$1" -o args= 2>/dev/null || true
}

process_start() {
  ps -p "$1" -o lstart= 2>/dev/null | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' || true
}

json_string_field() {
  key=$1
  file=$2
  sed -n "s/.*\"$key\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" "$file" 2>/dev/null | head -1
}

json_number_field() {
  key=$1
  file=$2
  sed -n "s/.*\"$key\"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p" "$file" 2>/dev/null | head -1
}

port_from_url() {
  printf '%s\n' "$1" | sed -n \
    -e 's,^[A-Za-z][A-Za-z0-9+.-]*://\[[^]]*\]:\([0-9][0-9]*\).*,\1,p' \
    -e 's,^[A-Za-z][A-Za-z0-9+.-]*://[^/:]*:\([0-9][0-9]*\).*,\1,p' | head -1
}

state_base_url() {
  value=$(json_string_field apiBaseUrl "$state_file")
  [ -n "$value" ] || value=$(json_string_field baseUrl "$state_file")
  printf '%s\n' "$value"
}

state_port() {
  json_number_field port "$state_file"
}

current_port() {
  if [ -n "$port" ]; then
    echo "$port"
    return 0
  fi
  value=$(state_port)
  if [ -n "$value" ]; then
    echo "$value"
    return 0
  fi
  value=$base_url
  [ -n "$value" ] || value=$(state_base_url)
  value=$(port_from_url "$value")
  [ -n "$value" ] && echo "$value" || true
}

current_base_url() {
  if [ -n "$base_url" ]; then
    echo "$base_url"
    return 0
  fi
  value=$(state_base_url)
  if [ -n "$value" ]; then
    echo "$value"
    return 0
  fi
  value=$(current_port)
  [ -n "$value" ] && echo "http://127.0.0.1:$value/v1" || true
}

looks_like_mlx_server() {
  process_args "$1" | grep -Eq '(^|[/[:space:]])mlx-serve([[:space:]]|$)'
}


state_pid() {
  json_number_field pid "$state_file"
}

state_process_start() {
  json_string_field processStart "$state_file"
}

active_lease_count() {
  mkdir -p "$client_dir" 2>/dev/null || true
  count=0
  now=$(date +%s)

  for file in "$client_dir"/*.json; do
    [ -e "$file" ] || continue
    name=${file##*/}
    pid=${name%.json}
    stale=0

    grep -q '"managedBy"[[:space:]]*:[[:space:]]*"pi-mlx-core-provider"' "$file" 2>/dev/null || stale=1
    grep -q '"usesMlx"[[:space:]]*:[[:space:]]*true' "$file" 2>/dev/null || stale=1
    pid_alive "$pid" || stale=1

    lease_start=$(json_string_field processStart "$file")
    proc_start=$(process_start "$pid")
    [ -n "$lease_start" ] || stale=1
    [ -n "$proc_start" ] || stale=1
    [ "$lease_start" = "$proc_start" ] || stale=1

    mt=$(mtime_sec "$file")
    if [ $((now - mt)) -gt "$lease_ttl_s" ]; then
      stale=1
    fi

    if [ "$stale" -eq 1 ]; then
      /usr/bin/trash "$file" 2>/dev/null || true
    else
      count=$((count + 1))
    fi
  done

  echo "$count"
}

mark_stopping() {
  pid=$1
  url=$(current_base_url)
  listen_port=$(current_port)
  [ -n "$listen_port" ] || listen_port=0
  proc_start=$(process_start "$pid")
  mkdir -p "$mlx_dir" 2>/dev/null || true
  cat > "$state_file.$$.tmp" <<EOF
{
  "managedBy": "$managed_by",
  "pid": $pid,
  "processStart": "$proc_start",
  "port": $listen_port,
  "baseUrl": "$url",
  "apiBaseUrl": "$url",
  "stopping": true,
  "stoppingAt": $(date +%s)000,
  "stoppingAtIso": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
}
EOF
  mv "$state_file.$$.tmp" "$state_file"
}

clear_state_if_dead() {
  pid=$1
  if ! pid_alive "$pid"; then
    /usr/bin/trash "$state_file" 2>/dev/null || true
  fi
}

managed_server_pid() {
  [ "$(json_string_field managedBy "$state_file")" = "$managed_by" ] || return 1
  pid=$(state_pid)
  if [ -n "$pid" ] && pid_alive "$pid" && looks_like_mlx_server "$pid"; then
    expected_start=$(state_process_start)
    current_start=$(process_start "$pid")
    listen_port=$(state_port)
    args=$(process_args "$pid")
    case "$args" in *"--host 127.0.0.1"*"--port $listen_port"*) ;; *) return 1 ;; esac
    if [ -n "$expected_start" ] && [ "$expected_start" = "$current_start" ]; then
      echo "$pid"
      return 0
    fi
  fi
  # Deliberately no port-based adoption: MLX Core app servers are never ours.
  return 1
}

server_has_clients() {
  pid=$(managed_server_pid || true)
  [ -n "$pid" ] || return 1
  command -v lsof >/dev/null 2>&1 || return 1
  lsof -nP -a -p "$pid" -iTCP -sTCP:ESTABLISHED 2>/dev/null | awk 'NR > 1 { found = 1 } END { exit found ? 0 : 1 }'
}

stop_server() {
  pid=$(managed_server_pid || true)

  if [ -z "$pid" ]; then
    /usr/bin/trash "$state_file" 2>/dev/null || true
    log "no active mlx-serve"
    return 0
  fi

  mark_stopping "$pid"
  if kill -TERM "$pid" 2>/dev/null; then
    log "sent SIGTERM to mlx-serve pid=$pid"
  else
    log "SIGTERM failed for mlx-serve pid=$pid"
    clear_state_if_dead "$pid"
    return 0
  fi

  waited=0
  while pid_alive "$pid" && [ "$waited" -lt "$shutdown_grace_s" ]; do
    sleep 1
    waited=$((waited + 1))
  done

  if pid_alive "$pid"; then
    log "mlx-serve pid=$pid still alive after ${shutdown_grace_s}s; sending SIGKILL"
    if [ "$(managed_server_pid || true)" = "$pid" ]; then
      kill -KILL "$pid" 2>/dev/null || true
    fi
    sleep 1
  fi

  clear_state_if_dead "$pid"
  log "mlx-serve pid=$pid stopped"
}

# Same directory-lock protocol as the TypeScript lifecycle. The upstream watchdog
# did not take this lock; sharing it closes the last-lease/new-client race.
lock_dir="$mlx_dir/lifecycle.lock"
watchdog_file="$mlx_dir/watchdog.json"
have_lock=0
unlock() {
  if [ "$have_lock" -eq 1 ]; then
    /usr/bin/trash "$lock_dir" || exit 1
    have_lock=0
  fi
}
trap 'unlock' EXIT
trap 'exit 0' TERM INT
lock() {
  if mkdir "$lock_dir" 2>/dev/null; then
    have_lock=1
    printf '{"pid": %s, "processStart": "%s"}\n' "$$" "$(process_start $$)" > "$lock_dir/owner.json"
    return 0
  fi
  owner=$(json_number_field pid "$lock_dir/owner.json")
  expected=$(json_string_field processStart "$lock_dir/owner.json")
  if [ -n "$owner" ]; then
    actual=$(process_start "$owner")
    if ! pid_alive "$owner" || { [ -n "$actual" ] && [ -n "$expected" ] && [ "$actual" != "$expected" ]; }; then
      /usr/bin/trash "$lock_dir" 2>/dev/null || true
    fi
  elif [ $(( $(date +%s) - $(mtime_sec "$lock_dir") )) -gt 60 ]; then
    /usr/bin/trash "$lock_dir" 2>/dev/null || true
  fi
  return 1
}
log "started for $mlx_dir"
while :; do
  if ! lock; then sleep "$poll_s"; continue; fi
  if [ "$(active_lease_count)" -eq 0 ] && ! server_has_clients; then
    log "no active MLX leases; stopping server"
    stop_server
    if [ "$(json_number_field pid "$watchdog_file")" = "$$" ]; then
      /usr/bin/trash "$watchdog_file" 2>/dev/null || true
    fi
    log "exiting"
    exit 0
  fi
  unlock
  sleep "$poll_s"
done
