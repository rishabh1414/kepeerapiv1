# Keeper File API

This is the only API project you need. It wraps Keeper Commander and keeps only the file-related routes:

- `GET /api/vault/list`
- `POST /api/vault/upload`
- `GET /api/vault/download/:recordId`

The container uses [`keeper-service/keeper-config.json`](/Volumes/T9/Code/Keeper App/Keeper_APIv1/keeper-service/keeper-config.json), so Keeper Commander starts with your saved config and does not require running login or verification commands again.

## Install

```bash
cd node-api
npm install
```

## Run locally

1. Start Keeper Commander with your existing config:

```bash
keeper service-start
```

2. In another terminal, start the Node API:

```bash
cd node-api
node src/index.js
```

## Run with Docker

Build from the project root:

```bash
docker build -t keeper-file-api .
```

Run the combined container:

```bash
docker run --rm -p 3000:3000 \
  -e PORT=3000 \
  -e KEEPER_SERVICE_URL=http://localhost:8900 \
  -e KEEPER_API_KEY=sPZuAbv9Q4oLsXUIqCANfK85dnc-SWI7Qbho21NBQW4= \
  -e NODE_API_KEY=my-secret-node-api-key-change-this \
  keeper-file-api
```

The root [`Dockerfile`](/Volumes/T9/Code/Keeper App/Keeper_APIv1/Dockerfile) starts both services inside one container:

- Keeper Commander service
- Node API

## Environment variables

```env
PORT=3000
KEEPER_SERVICE_URL=http://localhost:8900
KEEPER_API_KEY=sPZuAbv9Q4oLsXUIqCANfK85dnc-SWI7Qbho21NBQW4=
NODE_API_KEY=my-secret-node-api-key-change-this
```

## Endpoints

### Health

```bash
curl http://localhost:3000/health
```

### List records

```bash
curl -H "x-api-key: my-secret-node-api-key-change-this" \
  http://localhost:3000/api/vault/list
```

### Upload a file to a Keeper record

```bash
curl -X POST http://localhost:3000/api/vault/upload \
  -H "x-api-key: my-secret-node-api-key-change-this" \
  -F "recordTitle=My Record" \
  -F "file=@/path/to/file.pdf"
```

### Get record details and attachment info

```bash
curl -H "x-api-key: my-secret-node-api-key-change-this" \
  http://localhost:3000/api/vault/download/RECORD_UID
```

## Response format

Success:

```json
{
  "success": true,
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "error": "message"
}
```
