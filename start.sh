#!/bin/bash
set -e

KEEPER_PORT="${KEEPER_PORT:-8900}"
KEEPER_CONFIG_PATH="${KEEPER_CONFIG_PATH:-/app/keeper-service/keeper-config.json}"
KEEPER_CONFIG_JSON="${KEEPER_CONFIG_JSON:-}"
KEEPER_CONFIG_JSON_B64="${KEEPER_CONFIG_JSON_B64:-}"
PORT="${PORT:-3000}"

mkdir -p "$(dirname "$KEEPER_CONFIG_PATH")"

if [ ! -f "$KEEPER_CONFIG_PATH" ] && [ -n "$KEEPER_CONFIG_JSON" ]; then
  echo "Writing Keeper config from KEEPER_CONFIG_JSON to $KEEPER_CONFIG_PATH..."
  printf '%s' "$KEEPER_CONFIG_JSON" > "$KEEPER_CONFIG_PATH"
fi

if [ ! -f "$KEEPER_CONFIG_PATH" ] && [ -n "$KEEPER_CONFIG_JSON_B64" ]; then
  echo "Writing Keeper config from KEEPER_CONFIG_JSON_B64 to $KEEPER_CONFIG_PATH..."
  printf '%s' "$KEEPER_CONFIG_JSON_B64" | base64 -d > "$KEEPER_CONFIG_PATH"
fi

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
