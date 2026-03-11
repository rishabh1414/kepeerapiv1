const axios = require("axios");

const DEFAULT_TIMEOUT_MS = 15000;
const POLL_INTERVAL_MS = 500;
const MAX_RATE_LIMIT_RETRIES = 3;
const RATE_LIMIT_RETRY_MS = 1500;

function formatAxiosError(error, fallbackMessage) {
  if (!error) {
    return fallbackMessage;
  }

  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;

    if (typeof data === "string" && data.trim()) {
      return `Keeper service error (${status}): ${data}`;
    }

    if (data && typeof data === "object") {
      const detail = data.error || data.message || JSON.stringify(data);
      return `Keeper service error (${status}): ${detail}`;
    }

    return `Keeper service error (${status})`;
  }

  if (error.request) {
    return "Keeper service did not respond";
  }

  return error.message || fallbackMessage;
}

function isTerminalSuccess(data) {
  if (!data || typeof data !== "object") {
    return false;
  }

  const status = typeof data.status === "string" ? data.status.toLowerCase() : "";

  if (data.success === true) {
    return true;
  }

  if (Object.prototype.hasOwnProperty.call(data, "result") && !["queued", "running", "processing", "pending"].includes(status)) {
    return true;
  }

  return ["complete", "completed", "done", "finished", "success"].includes(status);
}

function getTerminalError(data) {
  if (!data || typeof data !== "object") {
    return null;
  }

  const status = typeof data.status === "string" ? data.status.toLowerCase() : "";

  if (["failed", "error", "cancelled", "canceled"].includes(status)) {
    return data.error || data.message || `Keeper command failed with status: ${data.status}`;
  }

  return null;
}

function getKeeperConfig() {
  const baseURL = process.env.KEEPER_SERVICE_URL;
  const apiKey = process.env.KEEPER_API_KEY;

  if (!baseURL || !apiKey) {
    throw new Error("KEEPER_SERVICE_URL and KEEPER_API_KEY must be configured");
  }

  return {
    baseURL: baseURL.replace(/\/+$/, ""),
    apiKey
  };
}

function getRetryDelayMs(error, attempt) {
  const retryAfterHeader = error?.response?.headers?.["retry-after"];
  const retryAfterSeconds = Number.parseInt(retryAfterHeader, 10);

  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }

  return RATE_LIMIT_RETRY_MS * attempt;
}

async function requestWithRetry(requestFn) {
  let attempt = 0;

  while (true) {
    try {
      return await requestFn();
    } catch (error) {
      const status = error?.response?.status;

      if (status !== 429 || attempt >= MAX_RATE_LIMIT_RETRIES) {
        throw error;
      }

      attempt += 1;
      const delayMs = getRetryDelayMs(error, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function executeCommand(command) {
  const { baseURL, apiKey } = getKeeperConfig();
  let response;

  try {
    response = await requestWithRetry(() =>
      axios.post(
        `${baseURL}/api/v2/executecommand-async`,
        { command },
        {
          headers: {
            "api-key": apiKey,
            "Content-Type": "application/json"
          }
        }
      )
    );
  } catch (error) {
    throw new Error(formatAxiosError(error, "Failed to execute Keeper command"));
  }

  if (!response.data || !response.data.request_id) {
    throw new Error("Keeper service did not return a request_id");
  }

  return response.data;
}

async function pollResult(requestId, options = {}) {
  const { baseURL, apiKey } = getKeeperConfig();
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
  const startTime = Date.now();
  let lastResponse = null;

  while (Date.now() - startTime < timeoutMs) {
    let response;

    try {
      response = await requestWithRetry(() =>
        axios.get(`${baseURL}/api/v2/result/${requestId}`, {
          headers: {
            "api-key": apiKey
          }
        })
      );
    } catch (error) {
      throw new Error(formatAxiosError(error, "Failed to fetch Keeper command result"));
    }

    const data = response.data;
    lastResponse = data;

    const terminalError = getTerminalError(data);
    if (terminalError) {
      throw new Error(terminalError);
    }

    if (isTerminalSuccess(data)) {
      return data;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  const lastStatus = lastResponse && lastResponse.status ? ` Last status: ${lastResponse.status}.` : "";
  throw new Error(`Timed out waiting for Keeper result for request ${requestId}.${lastStatus}`);
}

async function runCommand(command, options = {}) {
  const execution = await executeCommand(command);
  return pollResult(execution.request_id, options);
}

module.exports = {
  executeCommand,
  pollResult,
  runCommand
};
