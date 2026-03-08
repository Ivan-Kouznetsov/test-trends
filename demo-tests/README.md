# demo-tests

Jest suite that exercises the chaos server and records every request outcome to JSON through `data-capture`.

## What this module does
- Runs endpoint behavior tests for all chaos-server routes.
- Includes intentionally flaky tests to simulate intermittent failures.
- Runs concurrency scenarios to show failure-rate shifts under load.
- Captures per-test records under `data/<runId>/`.

## Install and run
```bash
cd demo-tests
npm install
npm test
```

## Required runtime
Start `chaos-server` first:
```bash
cd chaos-server
npm start
```

## Environment variables
- `CHAOS_SERVER_URL` (default: `http://localhost:3000`)
- `RUN_ID` (optional, auto-generated when omitted)
- `REQUEST_TIMEOUT_MS` (default: `2000`)
- `CAPTURE_DIR` (default: repo `data/`)
- `CONCURRENCY_LEVELS` (default: `2,5`)

## Flaky tests (intentional)
- `/50/mirror` expected as success can fail around 50% of time.
- `/50/409` expected as status-specific can fail around 50% of time.

These are included to produce realistic trend lines in analysis and dashboard modules.
