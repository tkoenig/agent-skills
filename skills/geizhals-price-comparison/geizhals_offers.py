#!/usr/bin/env python3
"""Backward-compatible wrapper for Geizhals offer extraction.

Usage:
  ./geizhals_offers.py URL [URL ...]

Equivalent to:
  ./geizhals.py offers URL [URL ...]
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


def main(argv: list[str]) -> int:
    script = Path(__file__).with_name("geizhals.py")
    return subprocess.call([sys.executable, str(script), "offers", *argv], env=os.environ.copy())


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
