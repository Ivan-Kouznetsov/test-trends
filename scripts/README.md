# scripts

Operational helpers for end-to-end demo flows.

## `install-all.sh`
Installs npm dependencies in all core submodules.

Run from repo root:
```bash
bash scripts/install-all.sh
```

## `demo-live.sh`
Starts chaos-server, runs demo tests against it, captures results, then writes dashboard summary data.

Run from repo root:
```bash
bash scripts/demo-live.sh
```

Environment variables:
- `CHAOS_PORT` (default: `3000`)
- `REQUEST_TIMEOUT_MS` (default: `2000`)
- `RUN_ID` (auto-generated if omitted)
- `CAPTURE_DIR` (default: `<repo>/data`)
- `SUMMARY_OUT` (default: `<repo>/dashboard/src/data/summary.json`)
- `MAX_TEST_ATTEMPTS` (default: `3`)
- `STRICT_TEST_EXIT` (default: `0`; set `1` to fail command when tests do not pass)

## `demo-dashboard.sh`
Generates synthetic historical data, builds summary JSON, and starts dashboard dev server.

Run from repo root:
```bash
bash scripts/demo-dashboard.sh
```

Environment variables:
- `FROM_DATE` (default: `2026-01-01`)
- `TO_DATE` (default: `2026-01-31`)
- `RUNS_PER_DAY` (default: `4`)
- `DASHBOARD_PORT` (default: `5173`)
- `SUMMARY_OUT` (default: `<repo>/dashboard/src/data/summary.json`)
