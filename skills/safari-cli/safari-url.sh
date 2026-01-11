#!/bin/bash

# Get URL of current Safari tab

osascript -e '
    tell application "Safari"
        if (count of windows) = 0 then
            return "error:No Safari window open"
        end if
        return URL of current tab of window 1
    end tell
' 2>/dev/null
