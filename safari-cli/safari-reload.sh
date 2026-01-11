#!/bin/bash

# Reload current Safari tab

osascript -e '
    tell application "Safari"
        if (count of windows) = 0 then
            return "✗ No Safari window open"
        end if
        tell window 1
            do JavaScript "location.reload()" in current tab
        end tell
        return "✓ Reloading: " & (name of current tab of window 1)
    end tell
' 2>/dev/null
