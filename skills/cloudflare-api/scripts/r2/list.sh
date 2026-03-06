#!/bin/bash
# List R2 buckets

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../_lib.sh"

OUTPUT="table"
JURISDICTION="eu"

while [[ $# -gt 0 ]]; do
    case $1 in
        --json) OUTPUT="json"; shift ;;
        --quiet) OUTPUT="quiet"; shift ;;
        --jurisdiction) JURISDICTION="$2"; shift 2 ;;
        --no-jurisdiction) JURISDICTION=""; shift ;;
        -h|--help)
            echo "Usage: r2/list.sh [options]"
            echo ""
            echo "Options:"
            echo "  --json                Raw JSON output"
            echo "  --quiet               Bucket names only"
            echo "  --jurisdiction JURIS  Data jurisdiction (default: eu)"
            echo "  --no-jurisdiction     No jurisdiction constraint (global)"
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

TOKEN=$(get_token)
if [ -z "$TOKEN" ]; then
    echo "❌ No API token. Run ./scripts/setup.sh first." >&2
    exit 1
fi

ACCOUNT_ID=$(get_account_id)
if [ -z "$ACCOUNT_ID" ]; then
    echo "❌ Could not get account ID" >&2
    exit 1
fi

# Set jurisdiction header
if [ -n "$JURISDICTION" ]; then
    CF_EXTRA_HEADERS=(-H "cf-r2-jurisdiction: $JURISDICTION")
fi

RESPONSE=$(cf_get "/accounts/$ACCOUNT_ID/r2/buckets")
check_error "$RESPONSE" || exit 1

case $OUTPUT in
    json)
        echo "$RESPONSE" | jq '.result.buckets'
        ;;
    quiet)
        echo "$RESPONSE" | jq -r '.result.buckets[].name'
        ;;
    table)
        echo ""
        printf "%-40s | %-12s | %-12s | %s\n" "BUCKET NAME" "LOCATION" "JURISDICTION" "CREATED"
        printf "%s\n" "------------------------------------------|--------------|--------------|------------------------"

        echo "$RESPONSE" | jq -r '.result.buckets[] | [.name, (.location // "auto"), (.jurisdiction // "default"), (.creation_date | split("T")[0])] | @tsv' | \
        while IFS=$'\t' read -r name location jurisdiction created; do
            printf "%-40s | %-12s | %-12s | %s\n" "$name" "$location" "$jurisdiction" "$created"
        done

        COUNT=$(echo "$RESPONSE" | jq '.result.buckets | length')
        echo ""
        echo "Total: $COUNT bucket(s)"
        ;;
esac
