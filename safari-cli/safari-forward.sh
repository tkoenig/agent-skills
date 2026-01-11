#!/bin/bash

# Go forward in Safari history

osascript -e '
    tell application "Safari"
        if (count of windows) = 0 then
            return "✗ No Safari window open"
        end if
        tell window 1
            do JavaScript "history.forward()" in current tab
        end tell
        delay 0.5
        return "✓ Went forward to: " & (name of current tab of window 1)
    end tell
' 2>/dev/null
