#!/bin/bash

# List all Safari tabs

osascript -e '
    tell application "Safari"
        if (count of windows) = 0 then
            return "No Safari windows open"
        end if
        
        set output to ""
        set windowCount to count of windows
        
        repeat with w from 1 to windowCount
            set tabCount to count of tabs of window w
            repeat with t from 1 to tabCount
                set tabName to name of tab t of window w
                set tabURL to URL of tab t of window w
                
                -- Mark current tab
                set isCurrent to ""
                if t = (index of current tab of window w) and w = 1 then
                    set isCurrent to " [active]"
                end if
                
                set output to output & "[" & w & ":" & t & "]" & isCurrent & " " & tabName & "
  " & tabURL & "
"
            end repeat
        end repeat
        
        return output
    end tell
' 2>/dev/null
