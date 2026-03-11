#!/bin/bash
set -e

echo "Starting Keeper Commander service..."
keeper --config /app/keeper-service/keeper-config.json service-start &

sleep 5

echo "Starting Node API..."
node /app/node-api/src/index.js
