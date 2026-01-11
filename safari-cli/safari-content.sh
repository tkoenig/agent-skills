#!/bin/bash

# Extract page content from Safari as text/markdown

URL="$1"

show_usage() {
    echo "Usage: safari-content.sh [url]"
    echo ""
    echo "Extracts readable content from Safari's current tab."
    echo "If URL is provided, navigates to it first."
    echo ""
    echo "Examples:"
    echo "  safari-content.sh                              # Extract from current tab"
    echo "  safari-content.sh https://example.com          # Navigate and extract"
}

if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    show_usage
    exit 0
fi

# Navigate if URL provided
if [ -n "$URL" ]; then
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
    
    # Wait for page to load
    sleep 2
    
    # Additional wait for dynamic content
    for i in {1..10}; do
        READY=$(osascript -e '
            tell application "Safari"
                try
                    return do JavaScript "document.readyState" in current tab of window 1
                on error
                    return "loading"
                end try
            end tell
        ' 2>/dev/null)
        
        if [ "$READY" = "complete" ]; then
            break
        fi
        sleep 0.5
    done
fi

# Extract content using JavaScript
RESULT=$(osascript -e '
    tell application "Safari"
        if (count of windows) = 0 then
            return "error:No Safari window open"
        end if
        
        set pageURL to URL of current tab of window 1
        set pageTitle to name of current tab of window 1
        
        try
            set pageContent to do JavaScript "
                (function() {
                    // Remove unwanted elements
                    const unwanted = document.querySelectorAll(\"script, style, noscript, nav, header, footer, aside, .advertisement, .ads, [role=banner], [role=navigation]\");
                    const clone = document.body.cloneNode(true);
                    clone.querySelectorAll(\"script, style, noscript, nav, header, footer, aside, .advertisement, .ads, [role=banner], [role=navigation]\").forEach(el => el.remove());
                    
                    // Try to find main content
                    const main = clone.querySelector(\"main, article, [role=main], .content, #content, .post, .article\") || clone;
                    
                    // Get text content, preserving some structure
                    function extractText(element, depth = 0) {
                        let result = \"\";
                        for (const node of element.childNodes) {
                            if (node.nodeType === Node.TEXT_NODE) {
                                const text = node.textContent.trim();
                                if (text) result += text + \" \";
                            } else if (node.nodeType === Node.ELEMENT_NODE) {
                                const tag = node.tagName.toLowerCase();
                                if ([\"h1\",\"h2\",\"h3\",\"h4\",\"h5\",\"h6\"].includes(tag)) {
                                    const level = parseInt(tag[1]);
                                    result += \"\\n\\n\" + \"#\".repeat(level) + \" \" + node.textContent.trim() + \"\\n\\n\";
                                } else if (tag === \"p\" || tag === \"div\") {
                                    result += \"\\n\\n\" + extractText(node, depth + 1) + \"\\n\";
                                } else if (tag === \"li\") {
                                    result += \"\\n- \" + extractText(node, depth + 1);
                                } else if (tag === \"br\") {
                                    result += \"\\n\";
                                } else if (tag === \"a\") {
                                    const href = node.getAttribute(\"href\");
                                    const text = node.textContent.trim();
                                    if (text && href && !href.startsWith(\"javascript:\")) {
                                        result += \"[\" + text + \"](\" + href + \") \";
                                    } else if (text) {
                                        result += text + \" \";
                                    }
                                } else if (tag === \"code\" || tag === \"pre\") {
                                    result += \"`\" + node.textContent + \"` \";
                                } else if (![\"script\",\"style\",\"noscript\"].includes(tag)) {
                                    result += extractText(node, depth + 1);
                                }
                            }
                        }
                        return result;
                    }
                    
                    let text = extractText(main);
                    // Clean up whitespace
                    text = text.replace(/[ \\t]+/g, \" \").replace(/\\n\\s*\\n\\s*\\n/g, \"\\n\\n\").trim();
                    return text;
                })()
            " in current tab of window 1
            
            return "URL: " & pageURL & "
Title: " & pageTitle & "

" & pageContent
            
        on error errMsg
            return "error:" & errMsg
        end try
    end tell
' 2>&1)

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
