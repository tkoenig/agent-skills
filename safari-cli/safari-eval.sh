#!/bin/bash

# Execute JavaScript in Safari's current tab

CODE="$*"

if [ -z "$CODE" ]; then
    echo "Usage: safari-eval.sh 'code'"
    echo ""
    echo "Examples:"
    echo "  safari-eval.sh 'document.title'"
    echo "  safari-eval.sh 'document.querySelectorAll(\"a\").length'"
    echo "  safari-eval.sh 'Array.from(document.querySelectorAll(\"h1\")).map(h => h.textContent)'"
    exit 1
fi

# Check if Safari has Allow JavaScript from Apple Events enabled
RESULT=$(osascript -e "
    tell application \"Safari\"
        if (count of windows) = 0 then
            return \"error:No Safari window open\"
        end if
        if (count of tabs of window 1) = 0 then
            return \"error:No tabs open\"
        end if
        try
            set jsResult to do JavaScript \"$CODE\" in current tab of window 1
            return jsResult
        on error errMsg
            return \"error:\" & errMsg
        end try
    end tell
" 2>&1)

if [[ "$RESULT" == error:* ]]; then
    ERROR_MSG="${RESULT#error:}"
    if [[ "$ERROR_MSG" == *"not allowed"* ]] || [[ "$ERROR_MSG" == *"execution was blocked"* ]]; then
        echo "✗ JavaScript execution blocked"
        echo ""
        echo "Enable JavaScript from Apple Events:"
        echo "  1. Open Safari"
        echo "  2. Menu: Develop > Allow JavaScript from Apple Events"
        echo ""
        echo "If Develop menu is hidden:"
        echo "  Safari > Settings > Advanced > Show features for web developers"
        exit 1
    else
        echo "✗ $ERROR_MSG"
        exit 1
    fi
else
    echo "$RESULT"
fi
