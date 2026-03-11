#!/bin/bash
set -e

mkdir -p /root/.keeper

echo "Starting Keeper Commander service..."
keeper service-start &

echo "Waiting for Keeper service to be ready..."
for _ in $(seq 1 30); do
  if curl -sf http://localhost:8900/api/v2/ping >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "Starting Node API..."
node /app/src/index.js
