#!/bin/bash
# Delete R2 bucket (must be empty)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../_lib.sh"

BUCKET_NAME=""
FORCE=false
JURISDICTION="eu"

while [[ $# -gt 0 ]]; do
    case $1 in
        --force|-f) FORCE=true; shift ;;
        --jurisdiction) JURISDICTION="$2"; shift 2 ;;
        --no-jurisdiction) JURISDICTION=""; shift ;;
        -h|--help)
            echo "Usage: r2/delete.sh <bucket-name> [options]"
            echo ""
            echo "Options:"
            echo "  --force, -f           Skip confirmation"
            echo "  --jurisdiction JURIS  Data jurisdiction (default: eu)"
            echo "  --no-jurisdiction     No jurisdiction constraint (global)"
            echo ""
            echo "Note: Bucket must be empty before deletion."
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
    echo "Usage: r2/delete.sh <bucket-name>"
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

if [ "$FORCE" != "true" ]; then
    echo "Delete R2 bucket '$BUCKET_NAME'?"
    echo "  ⚠️  Bucket must be empty."
    read -p "Confirm (y/N): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "Cancelled."
        exit 0
    fi
fi

RESPONSE=$(cf_delete "/accounts/$ACCOUNT_ID/r2/buckets/$BUCKET_NAME")

if check_error "$RESPONSE"; then
    echo "✅ Bucket '$BUCKET_NAME' deleted!"
else
    exit 1
fi
