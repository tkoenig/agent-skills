#!/bin/bash

# Get HTML source of current Safari page

osascript -e '
    tell application "Safari"
        if (count of windows) = 0 then
            return "error:No Safari window open"
        end if
        
        try
            set pageSource to do JavaScript "document.documentElement.outerHTML" in current tab of window 1
            return pageSource
        on error errMsg
            return "error:" & errMsg
        end try
    end tell
' 2>/dev/null
