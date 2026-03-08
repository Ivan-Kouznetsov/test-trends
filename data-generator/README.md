# Synthetic Test Data Generator

This tool creates synthetic JSON capture files that match the data-capture format used by the analysis CLI and dashboard. It spreads fake timestamps across a date range, generates a configurable number of test runs per day, and can be scaled up for load testing.

## Install

```bash
cd data-generator
npm install
```

## Generate synthetic data

Run the generator with a date range and runs per day:

```bash
node generate.js --from 2026-01-01 --to 2026-01-31 --runs-per-day 4
```

Or with npm:

```bash
npm run generate -- --from 2026-01-01 --to 2026-01-31 --runs-per-day 4
```

More control (bigger dataset + deterministic output):

```bash
node generate.js \
	--from 2026-01-01 \
	--to 2026-02-15 \
	--runs-per-day 10 \
	--suite-repeat 3 \
	--seed demo-seed \
	--output ../data
```

Options:
- `--from <date>` (required) start date (ISO or YYYY-MM-DD)
- `--to <date>` (required) end date (ISO or YYYY-MM-DD)
- `--runs-per-day <number>` number of runs per day (default: 4)
- `--suite-repeat <number>` repeat the base test suite per run (default: 1)
- `--concurrency-levels <list>` comma-separated levels (default: 2,5)
- `--output <path>` output directory (default: repo data/)
- `--seed <value>` seed for deterministic output
- `--run-prefix <value>` prefix for run IDs (default: synthetic-run)

## Analyze the generated data

Use the analysis CLI to summarize generated files and create dashboard input JSON:

```bash
node analysis-cli/cli.js --path ./data --format json --out dashboard/src/data/summary.json
```

## Show the data in the dashboard

The dashboard reads [dashboard/src/data/summary.json](dashboard/src/data/summary.json). After generating and analyzing data:

1. Run the analysis CLI to write summary.json into `dashboard/src/data`.
2. Start the dashboard dev server:

```bash
cd dashboard
npm install
npm run dev
```

3. Open the dashboard in the browser and confirm the new date range appears in the charts.

## One-command demo (generate -> analyze -> dashboard)

From repo root:

```bash
npm run demo:synthetic
```

For a live run against chaos-server and real test execution:

```bash
npm run demo:live
```

## Load testing guidance

To create large datasets for stress testing:

- Expand the date range (more days).
- Increase `--runs-per-day`.
- Increase `--suite-repeat` to multiply the number of records per run.
- Keep `--seed` fixed for repeatable load tests.
