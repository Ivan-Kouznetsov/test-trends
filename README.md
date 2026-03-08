# test-trends

`test-trends` is a JavaScript proejct for API reliability analysis:
- chaos API responses with controlled failure modes
- capture real test runs as JSON records
- aggregate those records with a CLI
- visualize trends in a React dashboard

## Quick Start
Install all module dependencies:
```bash
npm run setup
```

Run a live end-to-end capture flow (start chaos server -> run tests -> write dashboard summary):
```bash
npm run demo:live
```

Start dashboard dev server:
```bash
npm run dashboard:dev
```

Generate deterministic synthetic data and launch dashboard:
```bash
npm run demo:synthetic
```

## Module Map
- [chaos-server](chaos-server) - Express API with deterministic + probabilistic failure endpoints.
- [demo-tests](demo-tests) - Jest suite that calls chaos-server and records each request result.
- [data-capture](data-capture) - Shared JSON capture utility for per-test records.
- [analysis-cli](analysis-cli) - CLI summarizer that converts raw records into trend aggregates.
- [dashboard](dashboard) - React/Vite UI for trend exploration.
- [data-generator](data-generator) - Synthetic dataset generator.
- [scripts](scripts) - Operational scripts for setup and demos.

## End-to-End Data Flow
1. `chaos-server` receives test traffic.
2. `demo-tests` execute requests and call `data-capture`.
3. JSON records are written under `data/<runId>/`.
4. `analysis-cli` aggregates records into summary JSON.
5. `dashboard` reads `dashboard/src/data/summary.json` and renders charts/tables.

## Common Commands
- `npm run setup` - install dependencies across submodules.
- `npm run demo:live` - run live chaos-server + tests + capture + summary output (flaky tests may fail while data is still captured).
- `npm run analyze` - regenerate `dashboard/src/data/summary.json` from `data/`.
- `npm run demo:synthetic` - generate synthetic data and start dashboard.

## Demo Data Notes
- `data/` is generated output and is gitignored.
- Historical synthetic demo data is regenerated as needed.
- `dashboard/src/data/summary.json` is the dashboard input artifact.

## Troubleshooting
- If tests fail to connect, ensure port `3000` is free or set `CHAOS_PORT`.
- If dashboard looks stale, run `npm run analyze` to refresh summary data.
- If dependencies are missing, rerun `npm run setup`.
