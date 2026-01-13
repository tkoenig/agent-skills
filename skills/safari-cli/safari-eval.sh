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

# Use base64 to safely pass any JavaScript to AppleScript (avoids quote escaping issues)
# Wrap in a function that handles undefined results and errors
WRAPPED="(function(){try{var r=eval(atob('$(printf '%s' "$CODE" | base64)'));return r===undefined?'__undefined__':JSON.stringify(r)}catch(e){return '__error__:'+e.message}})()"

RESULT=$(osascript -e "tell application \"Safari\" to do JavaScript \"$WRAPPED\" in front document" 2>&1)

# Check for AppleScript-level errors
if [[ $? -ne 0 ]]; then
    if [[ "$RESULT" == *"not allowed"* ]] || [[ "$RESULT" == *"execution was blocked"* ]]; then
        echo "✗ JavaScript execution blocked"
        echo ""
        echo "Enable JavaScript from Apple Events:"
        echo "  1. Open Safari"
        echo "  2. Menu: Develop > Allow JavaScript from Apple Events"
        echo ""
        echo "If Develop menu is hidden:"
        echo "  Safari > Settings > Advanced > Show features for web developers"
        exit 1
    elif [[ "$RESULT" == *"No document"* ]] || [[ "$RESULT" == *"Can't get document"* ]]; then
        echo "✗ No Safari window open"
        exit 1
    else
        echo "✗ $RESULT"
        exit 1
    fi
fi

# Handle JS-level results
if [[ "$RESULT" == "__undefined__" ]]; then
    echo "undefined"
elif [[ "$RESULT" == __error__:* ]]; then
    echo "✗ JavaScript error: ${RESULT#__error__:}"
    exit 1
else
    # Parse JSON result back to readable format
    echo "$RESULT" | python3 -c "import sys,json; v=json.loads(sys.stdin.read()); print(v if isinstance(v,str) else json.dumps(v,indent=2))" 2>/dev/null || echo "$RESULT"
fi
