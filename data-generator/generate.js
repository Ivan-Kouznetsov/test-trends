#!/usr/bin/env node
const fs = require("fs/promises");
const path = require("path");
const { Command } = require("commander");

const DEFAULT_BASE_DIR = path.resolve(__dirname, "..", "data");

const sanitizeFileSegment = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const parseInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return date;
};

const startOfDayUtc = (date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));

const addDays = (date, days) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const dateRange = (from, to) => {
  const days = [];
  let cursor = startOfDayUtc(from);
  const end = startOfDayUtc(to);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor = addDays(cursor, 1);
  }
  return days;
};

const hashSeed = (value) => {
  let hash = 2166136261;
  const stringValue = String(value);
  for (let i = 0; i < stringValue.length; i += 1) {
    hash ^= stringValue.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const mulberry32 = (seed) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let result = Math.imul(t ^ (t >>> 15), t | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
};

const buildBaseTests = () => [
  {
    testName: "static mirror echoes body",
    endpoint: "/static/mirror",
    method: "post",
    request: { data: { hello: "world" }, headers: { "Content-Type": "application/json" } },
    success: { status: 200, data: { hello: "world" } },
    failure: { status: 500, data: { error: "Injected error" } },
    failureRate: 0.02,
    durationRange: [8, 20],
  },
  {
    testName: "odd-even request 1 returns 500",
    endpoint: "/odd-even",
    method: "post",
    request: { data: { seq: 1 }, headers: { "Content-Type": "application/json" } },
    success: { status: 200, data: { ok: true } },
    failure: { status: 500, data: { error: "Injected error (odd request)" } },
    failureRate: 0.35,
    durationRange: [1, 6],
  },
  {
    testName: "odd-even request 2 returns 200",
    endpoint: "/odd-even",
    method: "post",
    request: { data: { seq: 2 }, headers: { "Content-Type": "application/json" } },
    success: { status: 200, data: { ok: true } },
    failure: { status: 500, data: { error: "Injected error (odd request)" } },
    failureRate: 0.12,
    durationRange: [1, 6],
  },
  {
    testName: "mirror 0 percent success",
    endpoint: "/0/mirror",
    method: "post",
    request: { data: { ok: true }, headers: { "Content-Type": "application/json" } },
    success: { status: 200, data: { ok: true } },
    failure: { status: 500, data: { error: "Injected error" } },
    failureRate: 0.03,
    durationRange: [1, 4],
  },
  {
    testName: "mirror 100 percent failure",
    endpoint: "/100/mirror",
    method: "post",
    request: { data: { ok: false }, headers: { "Content-Type": "application/json" } },
    success: { status: 200, data: { ok: true } },
    failure: { status: 500, data: { error: "Injected error" } },
    failureRate: 0.85,
    durationRange: [1, 4],
  },
  {
    testName: "status code mirror 418",
    endpoint: "/0/418",
    method: "post",
    request: { data: { teapot: true }, headers: { "Content-Type": "application/json" } },
    success: { status: 200, data: { ok: true } },
    failure: { status: 418, data: { error: "I'm a teapot" } },
    failureRate: 0.18,
    durationRange: [1, 4],
  },
  {
    testName: "connection drop 100 percent",
    endpoint: "/100/connection",
    method: "post",
    request: { data: null, headers: {} },
    success: { status: 200, data: { ok: true } },
    error: { message: "socket hang up", code: "ECONNRESET", name: "Error" },
    failureRate: 0.08,
    durationRange: [20, 60],
  },
  {
    testName: "mirror 50 percent intermittent",
    endpoint: "/50/mirror",
    method: "post",
    request: { data: { flaky: true }, headers: { "Content-Type": "application/json" } },
    success: { status: 200, data: { ok: true } },
    failure: { status: 500, data: { error: "Injected error" } },
    failureRate: 0.32,
    durationRange: [1, 5],
  },
  {
    testName: "status code 50 percent intermittent",
    endpoint: "/50/409",
    method: "post",
    request: { data: { conflict: true }, headers: { "Content-Type": "application/json" } },
    success: { status: 200, data: { ok: true } },
    failure: { status: 500, data: { error: "Injected error" } },
    failureRate: 0.28,
    durationRange: [1, 5],
  },
];

const buildConcurrencyTests = (levels) =>
  levels.flatMap((level) =>
    Array.from({ length: level }, (_, index) => ({
      testName: `mirror 50 percent concurrency ${level} (worker ${index + 1})`,
      endpoint: "/50/mirror",
      method: "post",
      request: {
        data: { flaky: true, worker: index + 1, concurrency: level },
        headers: { "Content-Type": "application/json" },
      },
      success: { status: 200, data: { ok: true } },
      failure: { status: 500, data: { error: "Injected error" } },
      failureRate: 0.35 + Math.min(level / 20, 0.15),
      durationRange: [1, 6],
      concurrency: level,
    }))
  );

const pickStatus = (template, rng) => {
  if (template.error) {
    const roll = rng();
    if (roll < (template.failureRate || 0)) {
      return { response: null, error: template.error };
    }
    if (template.success) {
      return { response: template.success, error: null };
    }
    return { response: template.response || null, error: null };
  }
  if (template.response) {
    return { response: template.response, error: null };
  }
  const roll = rng();
  if (roll < (template.failureRate || 0)) {
    return { response: template.failure, error: null };
  }
  return { response: template.success, error: null };
};

const randomDuration = (range, rng) => {
  if (!range) return Math.round(rng() * 5);
  const [min, max] = range;
  return Math.round(min + (max - min) * rng());
};

const randomTimeInDay = (day, rng) => {
  const seconds = Math.floor(rng() * 24 * 60 * 60);
  return new Date(day.getTime() + seconds * 1000);
};

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true });
};

const writeRecord = async (baseDir, runId, record) => {
  const safeName = sanitizeFileSegment(record.testName || "test");
  const timestamp = record.timestamp.replace(/[:.]/g, "-");
  const fileName = `${timestamp}-${safeName}.json`;
  const runDir = path.join(baseDir, runId);
  await ensureDir(runDir);
  const filePath = path.join(runDir, fileName);
  await fs.writeFile(filePath, JSON.stringify(record, null, 2));
};

const buildRecord = ({ template, runId, timestamp, rng }) => {
  const { response, error } = pickStatus(template, rng);
  const durationMs = randomDuration(template.durationRange, rng);
  const concurrency = template.concurrency || 1;
  return {
    runId,
    testName: template.testName,
    endpoint: template.endpoint,
    method: template.method,
    request: {
      ...(template.request || {}),
      concurrency,
    },
    response,
    error,
    durationMs,
    concurrency,
    tags: ["synthetic", "demo-tests", `concurrency:${concurrency}`],
    timestamp: timestamp.toISOString(),
  };
};

const run = async () => {
  const program = new Command();
  program
    .option("--from <date>", "Start date (ISO or YYYY-MM-DD)")
    .option("--to <date>", "End date (ISO or YYYY-MM-DD)")
    .option("--runs-per-day <number>", "Runs per day", "4")
    .option("--suite-repeat <number>", "Repeat the base test suite per run", "1")
    .option("--concurrency-levels <list>", "Comma-separated concurrency levels", "2,5")
    .option("--output <path>", "Output directory for generated data", DEFAULT_BASE_DIR)
    .option("--seed <value>", "Seed for deterministic output")
    .option("--run-prefix <value>", "Run id prefix", "synthetic-run")
    .parse(process.argv);

  const options = program.opts();
  if (!options.from || !options.to) {
    throw new Error("Both --from and --to are required.");
  }

  const from = parseDate(options.from);
  const to = parseDate(options.to);
  if (from > to) {
    throw new Error("--from must be earlier than or equal to --to.");
  }

  const runsPerDay = Math.max(1, parseInteger(options.runsPerDay, 1));
  const suiteRepeat = Math.max(1, parseInteger(options.suiteRepeat, 1));
  const concurrencyLevels = String(options.concurrencyLevels || "")
    .split(",")
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value) && value > 0);

  const baseDir = path.resolve(process.cwd(), options.output || DEFAULT_BASE_DIR);
  await ensureDir(baseDir);

  const seedValue = options.seed ? hashSeed(options.seed) : Math.floor(Math.random() * 1e9);
  const rng = mulberry32(seedValue);

  const baseTests = buildBaseTests();
  const concurrencyTests = buildConcurrencyTests(concurrencyLevels);
  const templateSuite = [...baseTests, ...concurrencyTests];

  const days = dateRange(from, to);
  let totalRecords = 0;

  for (const day of days) {
    for (let runIndex = 0; runIndex < runsPerDay; runIndex += 1) {
      const runTime = randomTimeInDay(day, rng);
      const runId = `${options.runPrefix}-${day.toISOString().slice(0, 10)}-${runIndex + 1}-${Math.floor(rng() * 10000)}`;

      for (let repeat = 0; repeat < suiteRepeat; repeat += 1) {
        for (const template of templateSuite) {
          const offsetSeconds = Math.floor(rng() * 600);
          const timestamp = new Date(runTime.getTime() + offsetSeconds * 1000);
          const record = buildRecord({ template, runId, timestamp, rng });
          await writeRecord(baseDir, runId, record);
          totalRecords += 1;
        }
      }
    }
  }

  console.log(`Generated ${totalRecords} records in ${baseDir}`);
  console.log(`Seed: ${seedValue}`);
};

run().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
