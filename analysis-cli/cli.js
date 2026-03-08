#!/usr/bin/env node
const fs = require("fs/promises");
const path = require("path");
const { Command } = require("commander");

const program = new Command();

const toIsoDate = (value) => new Date(value);

const parseStatusFilter = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const sanitize = (value) => (value || "").toString().trim();

const collectJsonFiles = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const resolved = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectJsonFiles(resolved)));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(resolved);
    }
  }

  return files;
};

const parseConcurrency = (record) => {
  if (Number.isFinite(record.concurrency)) {
    return record.concurrency;
  }
  if (Array.isArray(record.tags)) {
    const tag = record.tags.find((value) => value.startsWith("concurrency:"));
    if (tag) {
      const parsed = Number.parseInt(tag.split(":")[1], 10);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return 1;
};

const isFailure = (record) => {
  if (record.error) {
    return true;
  }
  if (record.response && Number.isFinite(record.response.status)) {
    return record.response.status >= 400;
  }
  return false;
};

const extractErrorMessage = (record) => {
  if (record.error && record.error.message) {
    return record.error.message;
  }
  if (record.response && record.response.data) {
    if (typeof record.response.data === "string") {
      return record.response.data;
    }
    if (record.response.data.error) {
      return record.response.data.error;
    }
  }
  return null;
};

const groupBy = (records, keyFn) => {
  const map = new Map();
  for (const record of records) {
    const key = keyFn(record);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(record);
  }
  return map;
};

const summarizeGroup = (records) => {
  const total = records.length;
  const failures = records.filter(isFailure).length;
  const avgDuration = records.reduce((sum, record) => sum + (record.durationMs || 0), 0) / (total || 1);
  return {
    total,
    failures,
    failureRate: total ? failures / total : 0,
    avgDuration,
  };
};

const computeSummary = (records, filters) => {
  const endpointGroups = groupBy(records, (record) => record.endpoint || "unknown");
  const testGroups = groupBy(records, (record) => record.testName || "unknown");
  const concurrencyGroups = groupBy(records, (record) => parseConcurrency(record));
  const runGroups = groupBy(records, (record) => record.runId || "unknown");

  const statusCounts = {};
  const errorMessages = {};

  for (const record of records) {
    if (record.response && Number.isFinite(record.response.status)) {
      const key = record.response.status;
      statusCounts[key] = (statusCounts[key] || 0) + 1;
    }
    const errorMessage = extractErrorMessage(record);
    if (errorMessage) {
      errorMessages[errorMessage] = (errorMessages[errorMessage] || 0) + 1;
    }
  }

  const timeSeriesMap = groupBy(records, (record) => {
    if (!record.timestamp) return "unknown";
    return record.timestamp.slice(0, 10);
  });

  const timeSeries = Array.from(timeSeriesMap.entries())
    .map(([date, values]) => ({ date, ...summarizeGroup(values) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    generatedAt: new Date().toISOString(),
    filters,
    totals: summarizeGroup(records),
    byEndpoint: Array.from(endpointGroups.entries()).map(([endpoint, values]) => ({ endpoint, ...summarizeGroup(values) })),
    byTestName: Array.from(testGroups.entries()).map(([testName, values]) => ({ testName, ...summarizeGroup(values) })),
    byConcurrency: Array.from(concurrencyGroups.entries()).map(([concurrency, values]) => ({ concurrency: Number(concurrency), ...summarizeGroup(values) })),
    byRun: Array.from(runGroups.entries()).map(([runId, values]) => ({ runId, ...summarizeGroup(values) })),
    statusCodes: statusCounts,
    errorMessages,
    timeSeries,
    records,
  };
};

const formatPercent = (value) => `${(value * 100).toFixed(1)}%`;

const printTable = (title, rows, columns) => {
  console.log(`\n${title}`);
  if (!rows.length) {
    console.log("(no data)");
    return;
  }

  const widths = columns.map((column) =>
    Math.max(column.label.length, ...rows.map((row) => String(row[column.key]).length))
  );

  const header = columns
    .map((column, index) => column.label.padEnd(widths[index]))
    .join("  ");
  console.log(header);
  console.log(widths.map((width) => "-".repeat(width)).join("  "));

  for (const row of rows) {
    console.log(columns.map((column, index) => String(row[column.key]).padEnd(widths[index])).join("  "));
  }
};

const run = async () => {
  program
    .option("--path <path>", "Directory containing captured JSON files", path.resolve(__dirname, "..", "data"))
    .option("--from <date>", "Filter results from (ISO date)")
    .option("--to <date>", "Filter results to (ISO date)")
    .option("--endpoint <endpoint>", "Filter by endpoint")
    .option("--test <name>", "Filter by test name")
    .option("--status <status>", "Filter by HTTP status")
    .option("--format <format>", "Output format: table or json", "table")
    .option("--out <file>", "Write JSON output to file")
    .option("--no-records", "Exclude raw records from JSON output")
    .parse(process.argv);

  const options = program.opts();
  const basePath = path.resolve(process.cwd(), options.path);
  const from = options.from ? toIsoDate(options.from) : null;
  const to = options.to ? toIsoDate(options.to) : null;
  const statusFilter = options.status ? parseStatusFilter(options.status) : null;

  const files = await collectJsonFiles(basePath);
  const records = [];

  for (const file of files) {
    try {
      const raw = await fs.readFile(file, "utf8");
      const parsed = JSON.parse(raw);
      records.push(parsed);
    } catch (error) {
      console.warn(`Skipping unreadable file: ${file}`);
    }
  }

  let filtered = records;

  if (from) {
    filtered = filtered.filter((record) => record.timestamp && new Date(record.timestamp) >= from);
  }
  if (to) {
    filtered = filtered.filter((record) => record.timestamp && new Date(record.timestamp) <= to);
  }
  if (options.endpoint) {
    filtered = filtered.filter((record) => sanitize(record.endpoint) === sanitize(options.endpoint));
  }
  if (options.test) {
    filtered = filtered.filter((record) => sanitize(record.testName) === sanitize(options.test));
  }
  if (statusFilter !== null) {
    filtered = filtered.filter((record) => record.response && record.response.status === statusFilter);
  }

  const summary = computeSummary(
    options.records === false ? filtered.map(({ records: _, ...rest }) => rest) : filtered,
    {
      path: basePath,
      from: options.from || null,
      to: options.to || null,
      endpoint: options.endpoint || null,
      testName: options.test || null,
      status: statusFilter,
    }
  );

  if (options.out) {
    const outPath = path.resolve(process.cwd(), options.out);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, JSON.stringify(summary, null, 2));
  }

  if (options.format === "json") {
    if (!options.out) {
      console.log(JSON.stringify(summary, null, 2));
    }
    return;
  }

  const totalsRow = [{
    label: "Total",
    total: summary.totals.total,
    failures: summary.totals.failures,
    failureRate: formatPercent(summary.totals.failureRate),
    avgDuration: `${summary.totals.avgDuration.toFixed(1)}ms`,
  }];

  printTable("Totals", totalsRow, [
    { label: "Label", key: "label" },
    { label: "Total", key: "total" },
    { label: "Failures", key: "failures" },
    { label: "Failure Rate", key: "failureRate" },
    { label: "Avg Duration", key: "avgDuration" },
  ]);

  const endpointRows = summary.byEndpoint
    .map((entry) => ({
      endpoint: entry.endpoint,
      total: entry.total,
      failures: entry.failures,
      failureRate: formatPercent(entry.failureRate),
    }))
    .sort((a, b) => b.failures - a.failures);

  printTable("Failures by Endpoint", endpointRows, [
    { label: "Endpoint", key: "endpoint" },
    { label: "Total", key: "total" },
    { label: "Failures", key: "failures" },
    { label: "Failure Rate", key: "failureRate" },
  ]);

  const testRows = summary.byTestName
    .map((entry) => ({
      testName: entry.testName,
      total: entry.total,
      failures: entry.failures,
      failureRate: formatPercent(entry.failureRate),
    }))
    .sort((a, b) => b.failures - a.failures);

  printTable("Failures by Test", testRows, [
    { label: "Test", key: "testName" },
    { label: "Total", key: "total" },
    { label: "Failures", key: "failures" },
    { label: "Failure Rate", key: "failureRate" },
  ]);

  const concurrencyRows = summary.byConcurrency
    .map((entry) => ({
      concurrency: entry.concurrency,
      total: entry.total,
      failures: entry.failures,
      failureRate: formatPercent(entry.failureRate),
    }))
    .sort((a, b) => a.concurrency - b.concurrency);

  printTable("Failures by Concurrency", concurrencyRows, [
    { label: "Concurrency", key: "concurrency" },
    { label: "Total", key: "total" },
    { label: "Failures", key: "failures" },
    { label: "Failure Rate", key: "failureRate" },
  ]);

  const statusRows = Object.entries(summary.statusCodes)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  printTable("Status Codes", statusRows, [
    { label: "Status", key: "status" },
    { label: "Count", key: "count" },
  ]);

  const errorRows = Object.entries(summary.errorMessages)
    .map(([message, count]) => ({ message, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  printTable("Top Error Messages", errorRows, [
    { label: "Message", key: "message" },
    { label: "Count", key: "count" },
  ]);
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
