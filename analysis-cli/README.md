# analysis-cli

Command-line summarizer for captured JSON test records.

## What this module does
- Recursively reads captured JSON files from a data directory.
- Applies optional filters (date, endpoint, test, status).
- Produces aggregate metrics by endpoint/test/concurrency/run.
- Emits table output or JSON output for dashboard ingestion.

## Install
```bash
cd analysis-cli
npm install
```

## Run
```bash
node cli.js --path ../data
```

## Common commands
Generate dashboard input JSON:
```bash
node cli.js --path ../data --format json --out ../dashboard/src/data/summary.json
```

Date-filtered summary:
```bash
node cli.js --path ../data --from 2026-02-01 --to 2026-03-07
```

Endpoint-only filter:
```bash
node cli.js --path ../data --endpoint /50/mirror
```

## CLI options
- `--path <path>` data directory (default: `<repo>/data`)
- `--from <date>` include records on/after date
- `--to <date>` include records on/before date
- `--endpoint <endpoint>` exact endpoint filter
- `--test <name>` exact test name filter
- `--status <status>` HTTP status filter
- `--format <table|json>` output style (default: `table`)
- `--out <file>` write summary JSON to file
- `--no-records` omit raw `records` field from output JSON
