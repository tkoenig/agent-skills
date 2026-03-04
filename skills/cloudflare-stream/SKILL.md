---
name: cloudflare-stream
description: Cloudflare Stream video analytics via GraphQL API. Query video view counts, minutes watched, geographic breakdowns, and time series data. Use when asked about video analytics, view counts, streaming stats, or Cloudflare Stream data.
---

# Cloudflare Stream Analytics

Query video streaming analytics from Cloudflare Stream's GraphQL API.

## When to Use

- Get video view counts and minutes watched
- Analyze viewing patterns by country or time period
- Find top-watched videos
- Get daily/weekly/monthly viewing trends
- Look up metadata for specific video UIDs

## Prerequisites

```bash
export CLOUDFLARE_STREAM_API_TOKEN=your-api-token
export CLOUDFLARE_STREAM_ACCOUNT_ID=your-account-id
```

### Token Permissions

The API token needs **Account → Account Analytics → Read** permission in addition to Stream permissions.

Create or edit tokens at: https://dash.cloudflare.com/profile/api-tokens

### Verify Token

```bash
bash -c 'curl -s -H "Authorization: Bearer $CLOUDFLARE_STREAM_API_TOKEN" "https://api.cloudflare.com/client/v4/user/tokens/verify"' | jq .
```

> **Important:** When using `$VAR` in a command that pipes to another command, wrap the command containing `$VAR` in `bash -c '...'`. Environment variables are silently cleared when pipes are used directly.

## GraphQL Analytics API

**Endpoint:** `POST https://api.cloudflare.com/client/v4/graphql`

All analytics queries use the `streamMinutesViewedAdaptiveGroups` GraphQL node.

### Constraints

- **Max query interval:** 31 days per query (use multiple queries for longer ranges)
- **Data retention:** 90 days
- **The `count` field** in responses is the number of aggregated data points, **not** play events or unique viewers — only `sum.minutesViewed` is meaningful for measuring viewership

### Top Videos (Last 30 Days)

Write to `/tmp/cf_stream_request.json`:

```json
{
  "query": "{ viewer { accounts(filter: {accountTag: \"$ACCOUNT_ID\"}) { streamMinutesViewedAdaptiveGroups(filter: {date_geq: \"$START_DATE\", date_lt: \"$END_DATE\"}, orderBy: [sum_minutesViewed_DESC], limit: 20) { sum { minutesViewed } dimensions { uid } count } } } }"
}
```

Replace `$ACCOUNT_ID` with your `CLOUDFLARE_STREAM_ACCOUNT_ID`, and set date range (max 31 days apart). Then run:

```bash
bash -c 'curl -s -X POST \
  -H "Authorization: Bearer $CLOUDFLARE_STREAM_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/graphql" \
  -d @/tmp/cf_stream_request.json' | jq .
```

### Minutes Watched Per Video

Write to `/tmp/cf_stream_request.json` (replace `VIDEO_UID` with the actual video UID):

```json
{
  "query": "{ viewer { accounts(filter: {accountTag: \"$ACCOUNT_ID\"}) { streamMinutesViewedAdaptiveGroups(filter: {uid: \"VIDEO_UID\", date_geq: \"$START_DATE\", date_lt: \"$END_DATE\"}, orderBy: [sum_minutesViewed_DESC], limit: 100) { sum { minutesViewed } dimensions { uid date } count } } } }"
}
```

Replace `$ACCOUNT_ID`, `VIDEO_UID`, `$START_DATE`, `$END_DATE`. Then run:

```bash
bash -c 'curl -s -X POST \
  -H "Authorization: Bearer $CLOUDFLARE_STREAM_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/graphql" \
  -d @/tmp/cf_stream_request.json' | jq .
```

### Geographic Breakdown

Write to `/tmp/cf_stream_request.json`:

```json
{
  "query": "{ viewer { accounts(filter: {accountTag: \"$ACCOUNT_ID\"}) { streamMinutesViewedAdaptiveGroups(filter: {date_geq: \"$START_DATE\", date_lt: \"$END_DATE\"}, orderBy: [sum_minutesViewed_DESC], limit: 50) { sum { minutesViewed } dimensions { clientCountryName } count } } } }"
}
```

Replace `$ACCOUNT_ID`, `$START_DATE`, `$END_DATE`. Then run:

```bash
bash -c 'curl -s -X POST \
  -H "Authorization: Bearer $CLOUDFLARE_STREAM_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/graphql" \
  -d @/tmp/cf_stream_request.json' | jq .
```

### Daily Time Series

Write to `/tmp/cf_stream_request.json`:

```json
{
  "query": "{ viewer { accounts(filter: {accountTag: \"$ACCOUNT_ID\"}) { streamMinutesViewedAdaptiveGroups(filter: {date_geq: \"$START_DATE\", date_lt: \"$END_DATE\"}, orderBy: [dimensions_date_ASC], limit: 100) { sum { minutesViewed } dimensions { date } count } } } }"
}
```

Replace `$ACCOUNT_ID`, `$START_DATE`, `$END_DATE`. Then run:

```bash
bash -c 'curl -s -X POST \
  -H "Authorization: Bearer $CLOUDFLARE_STREAM_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/graphql" \
  -d @/tmp/cf_stream_request.json' | jq .
```

### Per-Video Geographic Breakdown

Write to `/tmp/cf_stream_request.json` (replace `VIDEO_UID`):

```json
{
  "query": "{ viewer { accounts(filter: {accountTag: \"$ACCOUNT_ID\"}) { streamMinutesViewedAdaptiveGroups(filter: {uid: \"VIDEO_UID\", date_geq: \"$START_DATE\", date_lt: \"$END_DATE\"}, orderBy: [sum_minutesViewed_DESC], limit: 50) { sum { minutesViewed } dimensions { uid clientCountryName } count } } } }"
}
```

Replace `$ACCOUNT_ID`, `VIDEO_UID`, `$START_DATE`, `$END_DATE`. Then run:

```bash
bash -c 'curl -s -X POST \
  -H "Authorization: Bearer $CLOUDFLARE_STREAM_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/graphql" \
  -d @/tmp/cf_stream_request.json' | jq .
```

### Combined Dimensions (Video + Country + Date)

Write to `/tmp/cf_stream_request.json`:

```json
{
  "query": "{ viewer { accounts(filter: {accountTag: \"$ACCOUNT_ID\"}) { streamMinutesViewedAdaptiveGroups(filter: {date_geq: \"$START_DATE\", date_lt: \"$END_DATE\"}, orderBy: [sum_minutesViewed_DESC], limit: 100) { sum { minutesViewed } dimensions { uid clientCountryName date } count } } } }"
}
```

Replace `$ACCOUNT_ID`, `$START_DATE`, `$END_DATE`. Then run:

```bash
bash -c 'curl -s -X POST \
  -H "Authorization: Bearer $CLOUDFLARE_STREAM_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/graphql" \
  -d @/tmp/cf_stream_request.json' | jq .
```

## Video Metadata API

Look up video details by UID (useful when a UID from analytics isn't in your local DB):

```bash
bash -c 'curl -s \
  -H "Authorization: Bearer $CLOUDFLARE_STREAM_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_STREAM_ACCOUNT_ID/stream/VIDEO_UID"' | jq '.result | {uid, meta, thumbnail, duration, created}'
```

### List All Videos

```bash
bash -c 'curl -s \
  -H "Authorization: Bearer $CLOUDFLARE_STREAM_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_STREAM_ACCOUNT_ID/stream?per_page=50"' | jq '.result | length'
```

### Storage Usage

```bash
bash -c 'curl -s \
  -H "Authorization: Bearer $CLOUDFLARE_STREAM_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_STREAM_ACCOUNT_ID/stream/storage-usage"' | jq .
```

## Available Dimensions

| Dimension | Description |
|-----------|-------------|
| `uid` | Video UID |
| `clientCountryName` | Viewer's country |
| `date` | Date (YYYY-MM-DD) |

Dimensions can be combined in a single query (e.g., `uid` + `clientCountryName` + `date`).

## Available Order By Options

| Order | Description |
|-------|-------------|
| `sum_minutesViewed_DESC` | Most watched first |
| `sum_minutesViewed_ASC` | Least watched first |
| `dimensions_date_ASC` | Oldest date first |
| `dimensions_date_DESC` | Newest date first |

## Filter Options

| Filter | Description |
|--------|-------------|
| `accountTag` | Required. Your Cloudflare account ID |
| `uid` | Filter to a specific video UID |
| `date_geq` | Start date (inclusive, YYYY-MM-DD) |
| `date_lt` | End date (exclusive, YYYY-MM-DD) |

## Important Notes

- **`videoPlaybackEventsAdaptiveGroups`** — another GraphQL node — only works with Cloudflare's own Stream Player embed. If using hls.js/vidstack/custom players, it returns empty results. Use `streamMinutesViewedAdaptiveGroups` instead.
- The `count` field counts aggregated data segments, not unique viewers or play events.
- For ranges longer than 31 days, split into multiple queries and merge results.

## Troubleshooting

### Empty Results

- Verify the token has **Account Analytics: Read** permission
- Ensure dates are within the 90-day retention window
- Check that `date_geq` and `date_lt` are at most 31 days apart
- Use `streamMinutesViewedAdaptiveGroups`, not `videoPlaybackEventsAdaptiveGroups`

### Permission Errors

Update your API token at https://dash.cloudflare.com/profile/api-tokens to include:
- **Account → Stream → Read** (for video metadata)
- **Account → Account Analytics → Read** (for analytics data)

## API Reference

- Stream API: https://developers.cloudflare.com/stream/
- Stream Analytics: https://developers.cloudflare.com/stream/getting-analytics/
- GraphQL Analytics: https://developers.cloudflare.com/analytics/graphql-api/
