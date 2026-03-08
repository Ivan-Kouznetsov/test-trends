const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const DEFAULT_BASE_DIR = path.resolve(__dirname, "..", "data");

const createRunId = () => {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `run-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const sanitizeFileSegment = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const captureResult = async ({
  runId,
  testName,
  endpoint,
  method,
  request,
  response,
  error,
  durationMs,
  concurrency,
  tags,
}) => {
  const baseDir = process.env.CAPTURE_DIR || DEFAULT_BASE_DIR;
  const resolvedRunId = runId || createRunId();
  const timestamp = new Date().toISOString();
  const safeName = sanitizeFileSegment(testName || "test");

  const runDir = path.join(baseDir, resolvedRunId);
  await fs.mkdir(runDir, { recursive: true });

  const fileName = `${timestamp.replace(/[:.]/g, "-")}-${safeName}.json`;
  const filePath = path.join(runDir, fileName);

  const payload = {
    runId: resolvedRunId,
    testName,
    endpoint,
    method,
    request,
    response,
    error,
    durationMs,
    concurrency,
    tags,
    timestamp,
  };

  await fs.writeFile(filePath, JSON.stringify(payload, null, 2));

  return filePath;
};

module.exports = {
  createRunId,
  captureResult,
};
