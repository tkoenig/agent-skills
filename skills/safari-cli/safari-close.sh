#!/bin/bash

# Close Safari tab(s)

TARGET="$1"

show_usage() {
    echo "Usage: safari-close.sh [window:tab]"
    echo ""
    echo "Examples:"
    echo "  safari-close.sh         # Close current tab"
    echo "  safari-close.sh 1:3     # Close tab 3 of window 1"
    echo ""
    echo "Use safari-tabs.sh to list all tabs"
}

if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    show_usage
    exit 0
fi

if [ -z "$TARGET" ]; then
    # Close current tab
    osascript -e '
        tell application "Safari"
            if (count of windows) = 0 then
                return "✗ No Safari windows open"
            end if
            set tabName to name of current tab of window 1
            close current tab of window 1
            return "✓ Closed: " & tabName
        end tell
    ' 2>/dev/null
else
    # Close specific tab
    WINDOW=$(echo "$TARGET" | cut -d: -f1)
    TAB=$(echo "$TARGET" | cut -d: -f2)
    
    if [ -z "$WINDOW" ] || [ -z "$TAB" ]; then
        echo "✗ Invalid format. Use window:tab (e.g., 1:3)"
        exit 1
    fi
    
    osascript -e "
        tell application \"Safari\"
            if (count of windows) < $WINDOW then
                return \"✗ Window $WINDOW does not exist\"
            end if
            if (count of tabs of window $WINDOW) < $TAB then
                return \"✗ Tab $TAB does not exist in window $WINDOW\"
            end if
            
            set tabName to name of tab $TAB of window $WINDOW
            close tab $TAB of window $WINDOW
            return \"✓ Closed: \" & tabName
        end tell
    " 2>/dev/null
fi
