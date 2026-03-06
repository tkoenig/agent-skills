#!/bin/bash
# Create R2 bucket

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../_lib.sh"

BUCKET_NAME=""
LOCATION=""
STORAGE_CLASS=""
JURISDICTION="eu"

while [[ $# -gt 0 ]]; do
    case $1 in
        --location) LOCATION="$2"; shift 2 ;;
        --storage-class) STORAGE_CLASS="$2"; shift 2 ;;
        --jurisdiction) JURISDICTION="$2"; shift 2 ;;
        --no-jurisdiction) JURISDICTION=""; shift ;;
        -h|--help)
            echo "Usage: r2/create.sh <bucket-name> [options]"
            echo ""
            echo "Options:"
            echo "  --location HINT       Location hint (e.g., wnam, enam, weur, eeur, apac)"
            echo "  --storage-class CLS   Default storage class (Standard, InfrequentAccess)"
            echo "  --jurisdiction JURIS  Data jurisdiction (default: eu)"
            echo "  --no-jurisdiction     No jurisdiction constraint (global)"
            echo ""
            echo "Jurisdictions:"
            echo "  eu     Data stays within the EU (GDPR compliance)"
            echo ""
            echo "Bucket naming rules:"
            echo "  - Lowercase letters (a-z), numbers (0-9), and hyphens (-)"
            echo "  - Cannot begin or end with a hyphen"
            echo "  - 3-63 characters"
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
    echo "Usage: r2/create.sh <bucket-name>"
    echo "Run with -h for help"
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

echo "Creating R2 bucket: $BUCKET_NAME"

# Set jurisdiction header
if [ -n "$JURISDICTION" ]; then
    CF_EXTRA_HEADERS=(-H "cf-r2-jurisdiction: $JURISDICTION")
    echo "   Jurisdiction: $JURISDICTION"
fi

# Build JSON payload
DATA=$(jq -n --arg name "$BUCKET_NAME" '{name: $name}')

if [ -n "$LOCATION" ]; then
    DATA=$(echo "$DATA" | jq --arg loc "$LOCATION" '. + {locationHint: $loc}')
fi

if [ -n "$STORAGE_CLASS" ]; then
    DATA=$(echo "$DATA" | jq --arg sc "$STORAGE_CLASS" '. + {storageClass: $sc}')
fi

RESPONSE=$(cf_post "/accounts/$ACCOUNT_ID/r2/buckets" "$DATA")

if check_error "$RESPONSE"; then
    echo "✅ Bucket '$BUCKET_NAME' created!"
    LOCATION_RESULT=$(echo "$RESPONSE" | jq -r '.result.location // "auto"')
    JURISDICTION_RESULT=$(echo "$RESPONSE" | jq -r '.result.jurisdiction // "default"')
    echo "   Location: $LOCATION_RESULT"
    echo "   Jurisdiction: $JURISDICTION_RESULT"
else
    exit 1
fi
