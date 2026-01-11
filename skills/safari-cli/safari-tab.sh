#!/bin/bash

# Switch to a specific Safari tab

TARGET="$1"

if [ -z "$TARGET" ]; then
    echo "Usage: safari-tab.sh <window:tab>"
    echo ""
    echo "Examples:"
    echo "  safari-tab.sh 1:3    # Switch to tab 3 of window 1"
    echo "  safari-tab.sh 1:1    # Switch to first tab of first window"
    echo ""
    echo "Use safari-tabs.sh to list all tabs"
    exit 1
fi

# Parse window:tab format
WINDOW=$(echo "$TARGET" | cut -d: -f1)
TAB=$(echo "$TARGET" | cut -d: -f2)

if [ -z "$WINDOW" ] || [ -z "$TAB" ]; then
    echo "✗ Invalid format. Use window:tab (e.g., 1:3)"
    exit 1
fi

osascript -e "
    tell application \"Safari\"
        activate
        if (count of windows) < $WINDOW then
            return \"error:Window $WINDOW does not exist\"
        end if
        if (count of tabs of window $WINDOW) < $TAB then
            return \"error:Tab $TAB does not exist in window $WINDOW\"
        end if
        
        set current tab of window $WINDOW to tab $TAB of window $WINDOW
        set index of window $WINDOW to 1
        
        return \"✓ Switched to tab $TAB of window $WINDOW: \" & name of tab $TAB of window $WINDOW
    end tell
" 2>/dev/null
