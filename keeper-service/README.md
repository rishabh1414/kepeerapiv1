# Keeper Commander Service Setup

This project expects Keeper Commander to run alongside the Node API.

`keeper-config.json` must be provided at runtime and must never be committed to git. For Cloud Run, mount it from Google Cloud Secret Manager at:

`/app/keeper-service/keeper-config.json`

The container startup script reads that file and starts Keeper Commander with it.

Files intentionally not committed:

- `keeper-config.json`
- `venv/`

Recommended runtime inputs:

- mounted secret file: `/app/keeper-service/keeper-config.json`
- environment variables from [`.env.example`](/Volumes/T9/Code/Keeper%20App/Keeper_APIv1/keeper-service/.env.example)

If the Keeper service API key changes, update the Node API runtime env accordingly.

Cloud Run runtime variables to set:

- `PORT=3000`
- `KEEPER_SERVICE_URL=http://localhost:8900`
- `KEEPER_API_KEY=your_generated_api_key_here`
- `NODE_API_KEY=your_node_api_key_here`
- `KEEPER_PORT=8900`
- `KEEPER_CONFIG_PATH=/app/keeper-service/keeper-config.json`
