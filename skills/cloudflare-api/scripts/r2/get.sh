#!/bin/bash
# Get R2 bucket details

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../_lib.sh"

BUCKET_NAME=""
OUTPUT="table"
JURISDICTION="eu"

while [[ $# -gt 0 ]]; do
    case $1 in
        --json) OUTPUT="json"; shift ;;
        --jurisdiction) JURISDICTION="$2"; shift 2 ;;
        --no-jurisdiction) JURISDICTION=""; shift ;;
        -h|--help)
            echo "Usage: r2/get.sh <bucket-name> [options]"
            echo ""
            echo "Options:"
            echo "  --json                Raw JSON output"
            echo "  --jurisdiction JURIS  Data jurisdiction (default: eu)"
            echo "  --no-jurisdiction     No jurisdiction constraint (global)"
            exit 0
            ;;
        *)
            if [ -z "$BUCKET_NAME" ]; then
                BUCKET_NAME="$1"
            fi
            shift
            ;;
    esac
done

if [ -z "$BUCKET_NAME" ]; then
    echo "Usage: r2/get.sh <bucket-name>"
    exit 1
fi

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

RESPONSE=$(cf_get "/accounts/$ACCOUNT_ID/r2/buckets/$BUCKET_NAME")
check_error "$RESPONSE" || exit 1

BUCKET=$(echo "$RESPONSE" | jq '.result')

if [ "$BUCKET" = "null" ]; then
    echo "❌ Bucket '$BUCKET_NAME' not found"
    exit 1
fi

if [ "$OUTPUT" = "json" ]; then
    echo "$BUCKET" | jq '.'
else
    echo ""
    echo "Bucket: $(echo "$BUCKET" | jq -r '.name')"
    echo "Location: $(echo "$BUCKET" | jq -r '.location // "auto"')"
    echo "Storage Class: $(echo "$BUCKET" | jq -r '.storage_class // "Standard"')"
    echo "Jurisdiction: $(echo "$BUCKET" | jq -r '.jurisdiction // "default"')"
    echo "Created: $(echo "$BUCKET" | jq -r '.creation_date // "unknown"')"
fi
