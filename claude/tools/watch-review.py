#!/usr/bin/env python3
"""Wait for a Claude coordinator's Rex status; never send terminal input."""

import json
import subprocess
import sys


TERMINAL_STATES = {"idle", "done", "blocked", "error"}


def objects(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from objects(child)
    elif isinstance(value, list):
        for child in value:
            yield from objects(child)


def contains(value, target):
    if isinstance(value, dict):
        return any(contains(child, target) for child in value.values())
    if isinstance(value, list):
        return any(contains(child, target) for child in value)
    return value == target


def root_state(records):
    for record in records:
        if record.get("id", "") == "" and record.get("effective_app", record.get("app")) == "claude-code":
            return record.get("state")
    return None


def event_state(event, block):
    if not contains(event, block):
        return None
    for item in objects(event):
        record = item.get("record")
        if item.get("id") == "" and isinstance(record, dict):
            state = root_state([record])
            if state:
                return state
    return None


def announce(state):
    if state in TERMINAL_STATES:
        print(f"CLAUDE_REVIEW_ATTENTION: coordinator state={state}. Capture the saved Rex pane; this is not proof of a complete review.", flush=True)
        return True
    return False


def main(session, block):
    # Subscribe first, then inspect the current state to cover an already-ended turn.
    stream = subprocess.Popen(
        ["rex", "events", "-s", session, "--json"],
        stdout=subprocess.PIPE, text=True,
    )
    try:
        snapshot = subprocess.run(
            ["rex", "block", "call", "-s", session, "-b", block, "program_status"],
            capture_output=True, text=True, check=True, timeout=20,
        )
        records = json.loads(snapshot.stdout)["records"]
        if not records:
            raise RuntimeError("Claude is not reporting Rex status; notification cannot be confirmed")
        if announce(root_state(records)):
            return
        print("Watching Claude coordinator status events (no polling).", flush=True)
        for line in stream.stdout:
            event = json.loads(line)
            if announce(event_state(event, block)):
                return
        raise RuntimeError("Rex event stream ended before Claude reported a terminal status")
    finally:
        stream.terminate()
        try:
            stream.wait(timeout=5)
        except subprocess.TimeoutExpired:
            stream.kill()
            stream.wait()


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("Usage: watch-review.py <rex-session-id> <rex-block-id>")
    try:
        main(*sys.argv[1:])
    except (RuntimeError, subprocess.SubprocessError, ValueError, KeyError) as error:
        sys.exit(f"Claude notification failed: {error}")
