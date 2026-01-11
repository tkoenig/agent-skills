#!/bin/bash

# Go back in Safari history

osascript -e '
    tell application "Safari"
        if (count of windows) = 0 then
            return "✗ No Safari window open"
        end if
        tell window 1
            do JavaScript "history.back()" in current tab
        end tell
        delay 0.5
        return "✓ Went back to: " & (name of current tab of window 1)
    end tell
' 2>/dev/null
