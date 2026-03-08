# data-capture

Shared utility for writing test request/response outcomes into JSON records for later aggregation.

## What this module does
- Generates run IDs (`createRunId`).
- Persists one JSON file per captured test (`captureResult`).
- Uses a stable record schema consumed by `analysis-cli` and `dashboard`.

## API
```js
const { createRunId, captureResult } = require("../data-capture");
```

### `createRunId()`
Returns a unique run id string.

### `captureResult(payload)`
Writes a JSON file in:
- `${CAPTURE_DIR || <repo>/data}/${runId}/<timestamp>-<test>.json`

Payload fields:
- `runId`, `testName`, `endpoint`, `method`
- `request`, `response`, `error`
- `durationMs`, `concurrency`, `tags`

Auto-added field:
- `timestamp` (ISO string)

## Environment variables
- `CAPTURE_DIR`: override base output directory.

## Record shape (example)
```json
{
  "runId": "live-run-2026-03-07-123000",
  "testName": "mirror 50 percent intermittent",
  "endpoint": "/50/mirror",
  "method": "post",
  "request": {"data": {"flaky": true}},
  "response": {"status": 500, "data": {"error": "Injected error"}},
  "error": null,
  "durationMs": 12,
  "concurrency": 1,
  "tags": ["demo-tests", "concurrency:1"],
  "timestamp": "2026-03-07T15:40:33.000Z"
}
```
