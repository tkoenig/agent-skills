#!/bin/bash

# Extract page content from Safari as text/markdown
# Uses Safari's Reader mode when available, falls back to JavaScript extraction

URL=""
NO_READER=false

show_usage() {
    echo "Usage: safari-content.sh [options] [url]"
    echo ""
    echo "Extracts readable content from Safari's current tab."
    echo "Uses Safari Reader mode when available for cleaner output."
    echo "If URL is provided, navigates to it first."
    echo ""
    echo "Options:"
    echo "  --no-reader    Skip Reader mode, use JavaScript extraction"
    echo "  -h, --help     Show this help message"
    echo ""
    echo "Examples:"
    echo "  safari-content.sh                              # Extract from current tab"
    echo "  safari-content.sh https://example.com          # Navigate and extract"
    echo "  safari-content.sh --no-reader https://docs.example.com  # Force JS extraction"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --no-reader)
            NO_READER=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            URL="$1"
            shift
            ;;
    esac
done

# Navigate if URL provided
if [ -n "$URL" ]; then
    osascript -e "
        tell application \"Safari\"
            activate
            open location \"$URL\"
        end tell
    " 2>/dev/null
    
    # Wait for page to load
    sleep 2
    
    # Additional wait for dynamic content
    for i in {1..10}; do
        READY=$(osascript -e '
            tell application "Safari"
                try
                    tell window 1
                        return do JavaScript "document.readyState" in current tab
                    end tell
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

# Get page URL and title first
PAGE_INFO=$(osascript -e '
    tell application "Safari"
        if (count of windows) = 0 then
            return "error:No Safari window open"
        end if
        tell window 1
            if (count of tabs) = 0 then
                return "error:No tabs open in Safari"
            end if
            set pageURL to URL of current tab
            set pageTitle to name of current tab
        end tell
        return pageURL & "|||" & pageTitle
    end tell
' 2>&1)

if [[ "$PAGE_INFO" == error:* ]]; then
    echo "✗ ${PAGE_INFO#error:}"
    exit 1
fi

PAGE_URL="${PAGE_INFO%%|||*}"
PAGE_TITLE="${PAGE_INFO#*|||}"

# Try to use Safari Reader mode (unless --no-reader is set)
READER_CONTENT="READER_NOT_AVAILABLE"
if [[ "$NO_READER" == "false" ]]; then
READER_CONTENT=$(osascript -e '
    tell application "Safari"
        activate
    end tell
    
    delay 0.3
    
    tell application "System Events"
        tell process "Safari"
            -- Check if Reader is available by looking at View menu
            set viewMenu to menu "View" of menu bar 1
            set menuItems to name of every menu item of viewMenu
            
            set readerAvailable to false
            set readerAlreadyActive to false
            
            if menuItems contains "Show Reader" then
                set readerAvailable to true
            else if menuItems contains "Hide Reader" then
                set readerAvailable to true
                set readerAlreadyActive to true
            end if
            
            if not readerAvailable then
                return "READER_NOT_AVAILABLE"
            end if
            
            -- Enable Reader if not already active
            if not readerAlreadyActive then
                click menu item "Show Reader" of menu "View" of menu bar 1
                delay 0.8
            end if
            
            -- Extract content using accessibility API
            set allText to ""
            try
                set scrollArea to scroll area 1 of group 1 of group 1 of tab group 1 of splitter group 1 of window 1
                set uiElement to UI element 1 of scrollArea
                set textElements to every static text of every group of group 1 of uiElement
                repeat with textGroup in textElements
                    repeat with t in textGroup
                        set textValue to value of t
                        if textValue is not missing value then
                            set allText to allText & textValue & linefeed
                        end if
                    end repeat
                end repeat
            on error errMsg
                -- Disable Reader before returning error
                if not readerAlreadyActive then
                    try
                        click menu item "Hide Reader" of menu "View" of menu bar 1
                    end try
                end if
                return "READER_ERROR:" & errMsg
            end try
            
            -- Disable Reader if we enabled it
            if not readerAlreadyActive then
                try
                    click menu item "Hide Reader" of menu "View" of menu bar 1
                end try
            end if
            
            return allText
        end tell
    end tell
' 2>&1)
fi

# Check if Reader extraction succeeded
if [[ "$NO_READER" == "false" ]] && [[ "$READER_CONTENT" != "READER_NOT_AVAILABLE" ]] && [[ "$READER_CONTENT" != READER_ERROR:* ]] && [[ -n "$READER_CONTENT" ]]; then
    echo "URL: $PAGE_URL"
    echo "Title: $PAGE_TITLE"
    echo ""
    echo "$READER_CONTENT"
    exit 0
fi

# Fall back to JavaScript extraction
RESULT=$(osascript -e '
    tell application "Safari"
        if (count of windows) = 0 then
            return "error:No Safari window open"
        end if
        
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
            
            return pageContent
            
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
    echo "URL: $PAGE_URL"
    echo "Title: $PAGE_TITLE"
    echo ""
    echo "$RESULT"
fi
