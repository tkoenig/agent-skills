---
name: grafana-k6-load-testing
description: Run and analyze Grafana Cloud k6 tests through the k6 CLI and read-only REST API. Use for k6 Cloud run status, processed results, thresholds, metrics, multi-zone tests, or load-test monitoring.
compatibility: Requires k6, Ruby, fnox, network access, and a K6_CLOUD_TOKEN injected by fnox.
---

# Grafana Cloud k6 load testing

Run cloud tests with the `k6` CLI. Query completed runs and metric metadata through Grafana Cloud k6's read-only REST API.

## Credentials

Use a Grafana Cloud k6 **Personal token** or **Stack token**, stored outside the repository. Never print, read, or paste its value.

Expected local setup:

```bash
fnox set --global --profile grafana-k6 K6_CLOUD_TOKEN
```

The command prompts with hidden input. Verify only the key name:

```bash
fnox --profile grafana-k6 list
```

Do not use `k6 cloud login --show`: it prints the locally stored token.

## CLI

Check that fnox-injected authentication works:

```bash
fnox exec --profile grafana-k6 -- k6 cloud project list
```

A cloud run normally returns after it reaches Grafana's running state only when passed `--exit-on-running`. Omit that flag to keep the terminal attached until completion:

```bash
fnox exec --profile grafana-k6 -- k6 cloud run script.js
```

A single Grafana Cloud Free run can use one load zone. Use sequential single-zone smokes, or an eligible paid plan for a distributed multi-zone run.

## Read-only REST API

Use `scripts/k6-api` through fnox. It reads `K6_CLOUD_TOKEN` only in-process and never prints it.

```bash
# Final state, durations, VUs, and pass/fail status
fnox exec --profile grafana-k6 -- scripts/k6-api run 8320401

# Metric names and types for a completed run
fnox exec --profile grafana-k6 -- scripts/k6-api metrics 8320401

# Matching time series; quote selectors to preserve brackets and braces
fnox exec --profile grafana-k6 -- \
  scripts/k6-api series 8320401 'http_req_duration{expected_response="true"}'
```

API endpoints:

- `GET https://api.k6.io/cloud/v5/test_runs/:id`
- `GET https://api.k6.io/cloud/v5/test_runs/:id/metrics`
- `GET https://api.k6.io/cloud/v5/test_runs/:id/series?match[]=...`

Run status `3` means finished. Result status `0` means thresholds passed. Processing status `2` means metrics are fully processed.

Use only `GET` endpoints unless the user explicitly approves an operation that creates, changes, or stops a cloud test.

## Result analysis

For each run, report:

- request count/rate, status failures, checks, and threshold results
- global p95 and p99 plus the slowest route groups
- load zone(s), cache behavior when the script records it, and auth/cache-bust mode
- origin health alongside k6: app/DB CPU, load, iowait, memory, swap, queue depth, and errors

Do not call a run healthy merely because it has no HTTP failures: a breached latency threshold, rising p95/p99, DB iowait, or queue growth needs investigation.

## Multi-region smoke tests

Geographic smokes validate Cloudflare edge behavior, cache warmth, and country-specific variants; they do not replace an origin-capacity run. Use current production traffic geography to choose zones and weights. On a single-zone plan, run low-RPS smokes sequentially from representative regions before comparing a higher-RPS capacity run.

## References

- [Grafana Cloud k6 authentication](https://grafana.com/docs/grafana-cloud/testing/k6/author-run/tokens-and-cli-authentication/)
- [Grafana Cloud k6 REST API](https://grafana.com/docs/grafana-cloud/testing/k6/reference/cloud-rest-api/)
