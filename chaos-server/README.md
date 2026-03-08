# chaos-server

Express.js API that returns static payloads and intentionally injects failures so tests can validate resilience and trend tooling.

## What this module does
- Hosts deterministic and probabilistic failure endpoints.
- Supports mirror-style payload testing and connection drop simulation.
- Acts as the target system for `demo-tests`.

## Install and run
```bash
cd chaos-server
npm install
npm start
```

Environment variables:
- `PORT` (default: `3000`)

## Endpoints (all `POST`)
- `/static/mirror`
: Always returns `200` with the same request body.
- `/odd-even`
: Alternates responses: odd requests return `500`, even requests return `200` + request body.
- `/:percentage/mirror`
: Returns `500` with probability `percentage` (0-100), otherwise `200` + request body.
- `/:percentage/connection`
: Drops the socket connection with probability `percentage`, otherwise `200`.
- `/:percentage/:statuscode`
: Returns `500` with probability `percentage`, otherwise returns provided `statuscode` (100-599) + request body.

## Notes
- Validation errors return `400` with a JSON error payload.
- Unknown routes return `404`.
- Unexpected exceptions return `500` with `Unexpected server error`.
