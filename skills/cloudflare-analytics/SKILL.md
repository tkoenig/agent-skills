---
name: cloudflare-analytics
description: Cloudflare analytics via GraphQL API. Query HTTP request stats (status codes, 404s, top paths), video streaming analytics (minutes watched, top videos), geographic breakdowns, and time series data. Use when asked about Cloudflare analytics, HTTP errors, video stats, or traffic data.
---

# Cloudflare Analytics

Query HTTP traffic and video streaming analytics from Cloudflare's GraphQL API.

## When to Use

- Investigate HTTP errors (404s, 5xx, etc.) across zones
- Analyze traffic patterns by path, host, country, or time
- Get video view counts and minutes watched
- Find top-watched videos
- Get daily/weekly/monthly trends
- Look up metadata for specific video UIDs

## Prerequisites

```bash
export CLOUDFLARE_STREAM_API_TOKEN=your-api-token
export CLOUDFLARE_STREAM_ACCOUNT_ID=your-account-id
```

### Token Permissions

The API token needs these permissions:
- **Account → Account Analytics → Read** (for Stream video analytics)
- **Account → Stream → Read** (for video metadata)
- **Zone → Analytics → Read** (for HTTP/zone analytics)

Create or edit tokens at: https://dash.cloudflare.com/profile/api-tokens

### Verify Token

```bash
bash -c 'curl -s -H "Authorization: Bearer $CLOUDFLARE_STREAM_API_TOKEN" "https://api.cloudflare.com/client/v4/user/tokens/verify"' | jq .
```

> **Important:** When using `$VAR` in a command that pipes to another command, wrap the command containing `$VAR` in `bash -c '...'`. Environment variables are silently cleared when pipes are used directly.

## List Zones

Find zone IDs (needed for HTTP analytics):

```bash
bash -c 'curl -s -H "Authorization: Bearer $CLOUDFLARE_STREAM_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones?account.id=$CLOUDFLARE_STREAM_ACCOUNT_ID"' | jq '.result[] | {id, name, status}'
```

---

## Zone / HTTP Analytics

**Endpoint:** `POST https://api.cloudflare.com/client/v4/graphql`

Uses `httpRequestsAdaptiveGroups` under `zones`. Requires zone tags.

### Constraints

- **Max query interval:** 24 hours (use `datetime_geq`/`datetime_lt` with ISO 8601 timestamps)
- For longer ranges, split into multiple 24h queries and merge results

### Requests by Status Code (e.g., 404s)

Write to `/tmp/cf_request.json` (replace `$ZONE_TAG`):

```json
{
  "query": "{ viewer { zones(filter: {zoneTag: \"$ZONE_TAG\"}) { httpRequestsAdaptiveGroups(filter: {datetime_geq: \"$START_DATETIME\", datetime_lt: \"$END_DATETIME\", edgeResponseStatus: 404}, limit: 50, orderBy: [count_DESC]) { count dimensions { clientRequestHTTPHost clientRequestPath } } } } }"
}
```

Replace `$ZONE_TAG`, `$START_DATETIME` (e.g., `2026-03-03T00:00:00Z`), `$END_DATETIME`. Then run:

```bash
bash -c 'curl -s -X POST \
  -H "Authorization: Bearer $CLOUDFLARE_STREAM_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/graphql" \
  -d @/tmp/cf_request.json' | jq '.data.viewer.zones[].httpRequestsAdaptiveGroups'
```

### Multiple Zones in One Query

Use `zoneTag_in` to query multiple zones at once:

```json
{
  "query": "{ viewer { zones(filter: {zoneTag_in: [\"$ZONE_TAG_1\", \"$ZONE_TAG_2\"]}) { httpRequestsAdaptiveGroups(filter: {datetime_geq: \"$START_DATETIME\", datetime_lt: \"$END_DATETIME\", edgeResponseStatus: 404}, limit: 50, orderBy: [count_DESC]) { count dimensions { clientRequestHTTPHost clientRequestPath } } } } }"
}
```

### Filter by Path Pattern

Use `clientRequestPath_like` with SQL LIKE wildcards:

```json
{
  "query": "{ viewer { zones(filter: {zoneTag: \"$ZONE_TAG\"}) { httpRequestsAdaptiveGroups(filter: {datetime_geq: \"$START_DATETIME\", datetime_lt: \"$END_DATETIME\", clientRequestPath_like: \"%rss%\"}, limit: 20, orderBy: [count_DESC]) { count dimensions { clientRequestHTTPHost clientRequestPath clientRequestHTTPMethodName } } } } }"
}
```

### Top Paths by Request Count

```json
{
  "query": "{ viewer { zones(filter: {zoneTag: \"$ZONE_TAG\"}) { httpRequestsAdaptiveGroups(filter: {datetime_geq: \"$START_DATETIME\", datetime_lt: \"$END_DATETIME\"}, limit: 50, orderBy: [count_DESC]) { count dimensions { clientRequestHTTPHost clientRequestPath edgeResponseStatus } } } } }"
}
```

### HTTP Dimensions

| Dimension | Description |
|-----------|-------------|
| `clientRequestHTTPHost` | Hostname |
| `clientRequestPath` | Request path |
| `clientRequestHTTPMethodName` | HTTP method (GET, POST, etc.) |
| `edgeResponseStatus` | HTTP status code |
| `clientCountryName` | Visitor's country |
| `clientRequestHTTPProtocol` | Protocol (HTTP/1.1, HTTP/2, etc.) |

### HTTP Filters

| Filter | Description |
|--------|-------------|
| `zoneTag` / `zoneTag_in` | Required. Zone ID(s) |
| `datetime_geq` | Start datetime (inclusive, ISO 8601) |
| `datetime_lt` | End datetime (exclusive, ISO 8601) |
| `edgeResponseStatus` | Filter by status code (e.g., 404, 500) |
| `clientRequestPath_like` | Path pattern (SQL LIKE with `%` wildcards) |
| `clientRequestHTTPHost` | Filter by hostname |
| `clientRequestHTTPMethodName` | Filter by method |

---

## Stream Video Analytics

Uses `streamMinutesViewedAdaptiveGroups` under `accounts`.

### Constraints

- **Max query interval:** 31 days per query (use `date_geq`/`date_lt` with YYYY-MM-DD)
- **Data retention:** 90 days
- **The `count` field** in responses is the number of aggregated data points, **not** play events or unique viewers — only `sum.minutesViewed` is meaningful

### Top Videos

Write to `/tmp/cf_request.json`:

```json
{
  "query": "{ viewer { accounts(filter: {accountTag: \"$ACCOUNT_ID\"}) { streamMinutesViewedAdaptiveGroups(filter: {date_geq: \"$START_DATE\", date_lt: \"$END_DATE\"}, orderBy: [sum_minutesViewed_DESC], limit: 20) { sum { minutesViewed } dimensions { uid } count } } } }"
}
```

Replace `$ACCOUNT_ID` with `CLOUDFLARE_STREAM_ACCOUNT_ID`, set date range (max 31 days). Then run:

```bash
bash -c 'curl -s -X POST \
  -H "Authorization: Bearer $CLOUDFLARE_STREAM_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/graphql" \
  -d @/tmp/cf_request.json' | jq .
```

### Minutes Watched Per Video

```json
{
  "query": "{ viewer { accounts(filter: {accountTag: \"$ACCOUNT_ID\"}) { streamMinutesViewedAdaptiveGroups(filter: {uid: \"$VIDEO_UID\", date_geq: \"$START_DATE\", date_lt: \"$END_DATE\"}, orderBy: [sum_minutesViewed_DESC], limit: 100) { sum { minutesViewed } dimensions { uid date } count } } } }"
}
```

### Geographic Breakdown (Videos)

```json
{
  "query": "{ viewer { accounts(filter: {accountTag: \"$ACCOUNT_ID\"}) { streamMinutesViewedAdaptiveGroups(filter: {date_geq: \"$START_DATE\", date_lt: \"$END_DATE\"}, orderBy: [sum_minutesViewed_DESC], limit: 50) { sum { minutesViewed } dimensions { clientCountryName } count } } } }"
}
```

### Daily Time Series (Videos)

```json
{
  "query": "{ viewer { accounts(filter: {accountTag: \"$ACCOUNT_ID\"}) { streamMinutesViewedAdaptiveGroups(filter: {date_geq: \"$START_DATE\", date_lt: \"$END_DATE\"}, orderBy: [dimensions_date_ASC], limit: 100) { sum { minutesViewed } dimensions { date } count } } } }"
}
```

### Combined Dimensions (Video + Country + Date)

```json
{
  "query": "{ viewer { accounts(filter: {accountTag: \"$ACCOUNT_ID\"}) { streamMinutesViewedAdaptiveGroups(filter: {date_geq: \"$START_DATE\", date_lt: \"$END_DATE\"}, orderBy: [sum_minutesViewed_DESC], limit: 100) { sum { minutesViewed } dimensions { uid clientCountryName date } count } } } }"
}
```

### Stream Dimensions

| Dimension | Description |
|-----------|-------------|
| `uid` | Video UID |
| `clientCountryName` | Viewer's country |
| `date` | Date (YYYY-MM-DD) |

Dimensions can be combined in a single query.

### Stream Order By

| Order | Description |
|-------|-------------|
| `sum_minutesViewed_DESC` | Most watched first |
| `sum_minutesViewed_ASC` | Least watched first |
| `dimensions_date_ASC` | Oldest date first |
| `dimensions_date_DESC` | Newest date first |

### Stream Filters

| Filter | Description |
|--------|-------------|
| `accountTag` | Required. Your Cloudflare account ID |
| `uid` | Filter to a specific video UID |
| `date_geq` | Start date (inclusive, YYYY-MM-DD) |
| `date_lt` | End date (exclusive, YYYY-MM-DD) |

---

## Video Metadata API

Look up video details by UID:

```bash
bash -c 'curl -s \
  -H "Authorization: Bearer $CLOUDFLARE_STREAM_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_STREAM_ACCOUNT_ID/stream/$VIDEO_UID"' | jq '.result | {uid, meta, thumbnail, duration, created}'
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

---

## Important Notes

- **Zone analytics** use `datetime_geq`/`datetime_lt` (ISO 8601) with a **24-hour max window**
- **Stream analytics** use `date_geq`/`date_lt` (YYYY-MM-DD) with a **31-day max window**
- **`videoPlaybackEventsAdaptiveGroups`** only works with Cloudflare's own Stream Player embed. If using hls.js/vidstack/custom players, it returns empty. Use `streamMinutesViewedAdaptiveGroups` instead.
- The `count` field in Stream results counts aggregated data segments, not unique viewers or play events.

## Troubleshooting

### Empty Results

- Verify the token has the required permissions (see Prerequisites)
- For zone analytics: ensure `datetime_geq` and `datetime_lt` are at most 24 hours apart
- For stream analytics: ensure dates are within the 90-day retention window and at most 31 days apart
- Use `streamMinutesViewedAdaptiveGroups`, not `videoPlaybackEventsAdaptiveGroups`

### "zones not authorized" Error

The token needs **Zone → Analytics → Read** permission. Update at https://dash.cloudflare.com/profile/api-tokens

### "account does not have access" Error

The token needs **Account → Account Analytics → Read** permission.

## API Reference

- GraphQL Analytics: https://developers.cloudflare.com/analytics/graphql-api/
- Stream Analytics: https://developers.cloudflare.com/stream/getting-analytics/
- Stream API: https://developers.cloudflare.com/stream/
