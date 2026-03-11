#!/bin/bash
set -e

KEEPER_PORT="${KEEPER_PORT:-8900}"
KEEPER_CONFIG_PATH="${KEEPER_CONFIG_PATH:-/app/keeper-service/keeper-config.json}"
PORT="${PORT:-3000}"

if [ ! -f "$KEEPER_CONFIG_PATH" ]; then
  echo "Keeper config file not found at $KEEPER_CONFIG_PATH"
  exit 1
fi

echo "Starting Keeper Commander service..."
keeper --config "$KEEPER_CONFIG_PATH" service-start &

echo "Waiting for Keeper Commander on port $KEEPER_PORT..."
sleep 5

echo "Starting Node API..."
export PORT
node /app/node-api/src/index.js
