#!/usr/bin/env python3
"""Run one synchronous GUI command and restore the previously focused window."""
import json
import os
from pathlib import Path
import subprocess
import sys


def request(ctl, *args):
    result = subprocess.run([ctl, *args], check=True, capture_output=True, text=True)
    # Mutations use a plain-text acknowledgement in OmniWM 0.7.6.
    # Queries must still return a valid response envelope.
    if result.stdout.strip() in ("", "executed") and args[:2] == ("window", "focus"):
        return {"ok": True}
    response = json.loads(result.stdout)
    if response.get("ok") is not True:
        raise RuntimeError("OmniWM rejected the request")
    return response


def main(argv=None):
    args = list(sys.argv[1:] if argv is None else argv)
    if args == ["--help"] or args == ["-h"]:
        print("Usage: with-focus.py -- <command> [arguments...]")
        return 0
    if len(args) < 2 or args[0] != "--":
        print("Usage: with-focus.py -- <command> [arguments...]", file=sys.stderr)
        return 64
    ctl = os.environ.get(
        "OMNIWMCTL", "/Applications/OmniWM.app/Contents/MacOS/omniwmctl"
    )
    if not Path(ctl).is_file() or not os.access(ctl, os.X_OK):
        print("Bundled omniwmctl is unavailable", file=sys.stderr)
        return 69
    try:
        response = request(ctl, "query", "focused-window", "--format", "json")
        window = response["result"]["payload"].get("window")
        window_id = window.get("id") if isinstance(window, dict) else None
        if not isinstance(window_id, str) or not window_id:
            raise RuntimeError("No focused managed window; command not run")
    except (OSError, subprocess.SubprocessError, ValueError, KeyError, RuntimeError) as exc:
        print(f"Cannot protect focus: {exc}", file=sys.stderr)
        return 2

    exit_code = 1
    restored = False
    try:
        exit_code = subprocess.run(args[1:]).returncode
        if exit_code < 0:
            exit_code = 128 - exit_code
    except KeyboardInterrupt:
        exit_code = 130
    except OSError as exc:
        print(f"Command failed: {exc}", file=sys.stderr)
        exit_code = 127
    finally:
        try:
            request(ctl, "window", "focus", window_id)
            restored = True
        except (OSError, subprocess.SubprocessError, ValueError, RuntimeError) as exc:
            print(f"Focus restoration failed: {exc}", file=sys.stderr)
    return exit_code if restored else (exit_code or 1)


if __name__ == "__main__":
    sys.exit(main())
