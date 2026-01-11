#!/bin/bash

# Navigate Safari to a URL

URL="$1"
NEW_TAB="$2"

if [ -z "$URL" ]; then
    echo "Usage: safari-nav.sh <url> [--new]"
    echo ""
    echo "Examples:"
    echo "  safari-nav.sh https://example.com       # Navigate current tab"
    echo "  safari-nav.sh https://example.com --new # Open in new tab"
    exit 1
fi

if [ "$NEW_TAB" = "--new" ]; then
    osascript -e "
        tell application \"Safari\"
            activate
            tell window 1
                set newTab to make new tab with properties {URL:\"$URL\"}
                set current tab to newTab
            end tell
        end tell
    " 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo "✓ Opened in new tab: $URL"
    else
        echo "✗ Failed to open URL"
        exit 1
    fi
else
    osascript -e "
        tell application \"Safari\"
            activate
            if (count of windows) = 0 then
                make new document with properties {URL:\"$URL\"}
            else
                set URL of current tab of window 1 to \"$URL\"
            end if
        end tell
    " 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo "✓ Navigated to: $URL"
    else
        echo "✗ Failed to navigate"
        exit 1
    fi
fi
