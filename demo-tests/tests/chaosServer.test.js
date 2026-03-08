const axios = require("axios");
const { createRunId, captureResult } = require("../../data-capture");

const baseUrl = process.env.CHAOS_SERVER_URL || "http://localhost:3000";
const runId = process.env.RUN_ID || createRunId();
const requestTimeoutMs = Number.parseInt(process.env.REQUEST_TIMEOUT_MS, 10) || 2000;
const concurrencyLevels = (process.env.CONCURRENCY_LEVELS || "2,5").split(",").map((value) => Number.parseInt(value, 10)).filter((value) => Number.isFinite(value) && value > 0);

const recordResult = async ({ testName, endpoint, method, request, response, error, durationMs, concurrency }) =>
  captureResult({
    runId,
    testName,
    endpoint,
    method,
    request,
    response,
    error,
    durationMs,
    concurrency,
    tags: ["demo-tests", concurrency ? `concurrency:${concurrency}` : "concurrency:1"],
  });

const runRequest = async ({ testName, method, path, data, headers, expectStatus, allowStatuses, expectConnectionDrop, concurrency = 1 }) => {
  const url = `${baseUrl}${path}`;
  const start = Date.now();
  let response;
  let error;

  try {
    const result = await axios({
      method,
      url,
      data,
      headers,
      timeout: requestTimeoutMs,
      validateStatus: () => true,
    });

    response = {
      status: result.status,
      data: result.data,
      headers: result.headers,
    };
  } catch (err) {
    error = {
      message: err.message,
      code: err.code,
      name: err.name,
    };
  }

  const durationMs = Date.now() - start;
  await recordResult({ testName, endpoint: path, method, request: { data, headers, concurrency }, response, error, durationMs, concurrency });

  if (expectConnectionDrop) {
    expect(error).toBeTruthy();
    return;
  }

  expect(error).toBeFalsy();

  if (expectStatus) {
    expect(response.status).toBe(expectStatus);
  }

  if (allowStatuses) {
    expect(allowStatuses).toContain(response.status);
  }
};

const runConcurrentRequests = async ({ testName, method, path, dataFactory, headers, allowStatuses, concurrency }) => {
  const tasks = Array.from({ length: concurrency }, (_, index) =>
    runRequest({
      testName: `${testName} (worker ${index + 1})`,
      method,
      path,
      data: typeof dataFactory === "function" ? dataFactory(index) : dataFactory,
      headers,
      allowStatuses,
      concurrency,
    })
  );

  await Promise.all(tasks);
};

describe("Chaos server endpoints", () => {
  test("/static/mirror returns the posted body", async () => {
    await runRequest({
      testName: "static mirror echoes body",
      method: "post",
      path: "/static/mirror",
      data: { hello: "world" },
      headers: { "Content-Type": "application/json" },
      expectStatus: 200,
    });
  });

  test("/odd-even alternates failure and success", async () => {
    await runRequest({
      testName: "odd-even request 1 returns 500",
      method: "post",
      path: "/odd-even",
      data: { seq: 1 },
      headers: { "Content-Type": "application/json" },
      expectStatus: 500,
    });

    await runRequest({
      testName: "odd-even request 2 returns 200",
      method: "post",
      path: "/odd-even",
      data: { seq: 2 },
      headers: { "Content-Type": "application/json" },
      expectStatus: 200,
    });
  });

  test("/{percentage}/mirror returns 200 when percentage is 0", async () => {
    await runRequest({
      testName: "mirror 0 percent success",
      method: "post",
      path: "/0/mirror",
      data: { ok: true },
      headers: { "Content-Type": "application/json" },
      expectStatus: 200,
    });
  });

  test("/{percentage}/mirror returns 500 when percentage is 100", async () => {
    await runRequest({
      testName: "mirror 100 percent failure",
      method: "post",
      path: "/100/mirror",
      data: { ok: false },
      headers: { "Content-Type": "application/json" },
      expectStatus: 500,
    });
  });

  test("/{percentage}/{statuscode} returns provided status", async () => {
    await runRequest({
      testName: "status code mirror 418",
      method: "post",
      path: "/0/418",
      data: { teapot: true },
      headers: { "Content-Type": "application/json" },
      expectStatus: 418,
    });
  });

  test("/{percentage}/connection drops the connection", async () => {
    await runRequest({
      testName: "connection drop 100 percent",
      method: "post",
      path: "/100/connection",
      expectConnectionDrop: true,
    });
  });

  test("/{percentage}/mirror intermittently fails", async () => {
    await runRequest({
      testName: "mirror 50 percent intermittent",
      method: "post",
      path: "/50/mirror",
      data: { flaky: true },
      headers: { "Content-Type": "application/json" },
      expectStatus: 200,
    });
  });

  test("/{percentage}/{statuscode} intermittently fails", async () => {
    await runRequest({
      testName: "status code 50 percent intermittent",
      method: "post",
      path: "/50/409",
      data: { conflict: true },
      headers: { "Content-Type": "application/json" },
      expectStatus: 409,
    });
  });

  test("concurrency impact on mirror flakiness", async () => {
    for (const concurrency of concurrencyLevels) {
      await runConcurrentRequests({
        testName: `mirror 50 percent concurrency ${concurrency}`,
        method: "post",
        path: "/50/mirror",
        dataFactory: (index) => ({ flaky: true, worker: index + 1, concurrency }),
        headers: { "Content-Type": "application/json" },
        allowStatuses: [200, 500],
        concurrency,
      });
    }
  });
});
