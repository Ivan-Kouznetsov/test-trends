import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { Line, getElementAtEvent } from "react-chartjs-2";
import summaryData from "./data/summary.json";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

const formatPercent = (value) => `${(value * 100).toFixed(1)}%`;

const isFailure = (record) => {
  if (record.error) return true;
  if (record.response && Number.isFinite(record.response.status)) {
    return record.response.status >= 400;
  }
  return false;
};

const parseConcurrency = (record) => {
  if (Number.isFinite(record.concurrency)) return record.concurrency;
  if (Array.isArray(record.tags)) {
    const tag = record.tags.find((value) => value.startsWith("concurrency:"));
    if (tag) {
      const parsed = Number.parseInt(tag.split(":")[1], 10);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 1;
};

const summarize = (records) => {
  const total = records.length;
  const failures = records.filter(isFailure).length;
  const avgDuration = total
    ? records.reduce((sum, record) => sum + (record.durationMs || 0), 0) / total
    : 0;
  return { total, failures, failureRate: total ? failures / total : 0, avgDuration };
};

const groupBy = (records, keyFn) => {
  const map = new Map();
  for (const record of records) {
    const key = keyFn(record);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(record);
  }
  return map;
};

const buildSeries = (records) => {
  const seriesMap = groupBy(records, (record) => (record.timestamp || "").slice(0, 10));
  return Array.from(seriesMap.entries())
    .map(([date, values]) => ({ date, ...summarize(values) }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

const BarChart = ({ title, data, labelKey, valueKey }) => {
  const max = Math.max(...data.map((item) => item[valueKey]), 1);
  return (
    <section className="card">
      <h3>{title}</h3>
      <div className="bar-chart">
        {data.map((item) => (
          <div key={item[labelKey]} className="bar-row">
            <span className="bar-label">{item[labelKey]}</span>
            <div className="bar">
              <div className="bar-fill" style={{ width: `${(item[valueKey] / max) * 100}%` }} />
            </div>
            <span className="bar-value">{item[valueKey]}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

const LineChart = ({ title, data }) => {
  const chartRef = useRef(null);
  const [pinnedIndex, setPinnedIndex] = useState(null);

  useEffect(() => {
    if (pinnedIndex === null) return;
    if (!data[pinnedIndex]) {
      setPinnedIndex(null);
    }
  }, [data, pinnedIndex]);

  if (!data.length) {
    return (
      <section className="card">
        <h3>{title}</h3>
        <p>No data.</p>
      </section>
    );
  }

  const pinnedItem = pinnedIndex === null ? null : data[pinnedIndex];

  const chartData = useMemo(
    () => ({
      labels: data.map((item) => item.date),
      datasets: [
        {
          data: data.map((item) => Number((item.failureRate * 100).toFixed(2))),
          borderColor: "#4f46e5",
          backgroundColor: "rgba(79, 70, 229, 0.12)",
          fill: true,
          borderWidth: 1.4,
          tension: 0.3,
          pointRadius: (context) => (context.dataIndex === pinnedIndex ? 4 : 2),
          pointHoverRadius: 4,
          pointHitRadius: 18,
          pointBackgroundColor: (context) =>
            context.dataIndex === pinnedIndex ? "#3730a3" : "#4f46e5",
          pointBorderWidth: 0,
        },
      ],
    }),
    [data, pinnedIndex]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: {
        mode: "nearest",
        intersect: false,
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            autoSkip: true,
            maxRotation: 0,
            color: "#6b7280",
            maxTicksLimit: 6,
          },
        },
        y: {
          min: 0,
          max: 100,
          ticks: {
            color: "#9ca3af",
            callback: (value) => `${value}%`,
            maxTicksLimit: 5,
          },
          grid: {
            color: "#e5e7eb",
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            title: (items) => items[0]?.label || "",
            label: (context) => {
              const item = data[context.dataIndex];
              if (!item) return "";
              return [
                `Value: ${item.failures}/${item.total}`,
                `Failure rate: ${formatPercent(item.failureRate)}`,
              ];
            },
          },
        },
      },
    }),
    [data]
  );

  const handleChartClick = (event) => {
    if (!chartRef.current) return;
    const points = getElementAtEvent(chartRef.current, event);
    if (!points.length) return;
    const index = points[0].index;
    setPinnedIndex((prev) => (prev === index ? null : index));
  };

  return (
    <section className="card">
      <h3>{title}</h3>
      <p className="line-chart-hint">Hover for details. Tap/click a point to pin.</p>
      <div className="line-chart-canvas">
        <Line ref={chartRef} data={chartData} options={options} onClick={handleChartClick} />
      </div>
      {pinnedItem && (
        <div className="line-chart-pinned-panel" role="status" aria-live="polite">
          <div>
            <p className="line-chart-panel-label">Pinned point</p>
            <p className="line-chart-panel-value">{pinnedItem.date}</p>
          </div>
          <div>
            <p className="line-chart-panel-label">Value</p>
            <p className="line-chart-panel-value">{pinnedItem.failures}/{pinnedItem.total}</p>
          </div>
          <div>
            <p className="line-chart-panel-label">Failure rate</p>
            <p className="line-chart-panel-value">{formatPercent(pinnedItem.failureRate)}</p>
          </div>
          <div className="line-chart-panel-actions">
            <button type="button" onClick={() => setPinnedIndex(null)}>
              Clear
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

const Table = ({ title, columns, rows }) => (
  <section className="card">
    <h3>{title}</h3>
    <table>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key}>{column.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            {columns.map((column) => (
              <td key={column.key}>{row[column.key]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </section>
);

const App = () => {
  const [summary] = useState(summaryData);
  const [filters, setFilters] = useState({
    endpoint: "",
    testName: "",
    status: "",
    concurrency: "",
    search: "",
  });

  const records = summary?.records || [];

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      if (filters.endpoint && record.endpoint !== filters.endpoint) return false;
      if (filters.testName && record.testName !== filters.testName) return false;
      if (filters.status && record.response?.status !== Number(filters.status)) return false;
      if (filters.concurrency && parseConcurrency(record) !== Number(filters.concurrency)) return false;
      if (filters.search) {
        const message = record.error?.message || record.response?.data?.error || "";
        if (!message.toLowerCase().includes(filters.search.toLowerCase())) return false;
      }
      return true;
    });
  }, [records, filters]);

  const totals = useMemo(() => summarize(filteredRecords), [filteredRecords]);
  const endpoints = useMemo(() => {
    const groups = groupBy(filteredRecords, (record) => record.endpoint || "unknown");
    return Array.from(groups.entries())
      .map(([endpoint, values]) => ({ endpoint, ...summarize(values) }))
      .sort((a, b) => b.failures - a.failures)
      .slice(0, 10);
  }, [filteredRecords]);

  const tests = useMemo(() => {
    const groups = groupBy(filteredRecords, (record) => record.testName || "unknown");
    return Array.from(groups.entries())
      .map(([testName, values]) => ({ testName, ...summarize(values) }))
      .sort((a, b) => b.failures - a.failures)
      .slice(0, 10);
  }, [filteredRecords]);

  const concurrency = useMemo(() => {
    const groups = groupBy(filteredRecords, (record) => parseConcurrency(record));
    return Array.from(groups.entries())
      .map(([level, values]) => ({ concurrency: Number(level), ...summarize(values) }))
      .sort((a, b) => a.concurrency - b.concurrency);
  }, [filteredRecords]);

  const timeSeries = useMemo(() => buildSeries(filteredRecords), [filteredRecords]);

  const statusRows = useMemo(() => {
    const counts = {};
    for (const record of filteredRecords) {
      if (record.response?.status) {
        counts[record.response.status] = (counts[record.response.status] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredRecords]);

  const errorRows = useMemo(() => {
    const counts = {};
    for (const record of filteredRecords) {
      const message = record.error?.message || record.response?.data?.error;
      if (message) counts[message] = (counts[message] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredRecords]);

  const endpointsOptions = useMemo(() => Array.from(new Set(records.map((record) => record.endpoint))).filter(Boolean), [records]);
  const testOptions = useMemo(() => Array.from(new Set(records.map((record) => record.testName))).filter(Boolean), [records]);
  const concurrencyOptions = useMemo(() => Array.from(new Set(records.map(parseConcurrency))).sort((a, b) => a - b), [records]);

  if (!summary) {
    return <div className="page"><p>Loading summary...</p></div>;
  }

  return (
    <div className="page">
      <header>
        <div>
          <h1>API Testing Trends Dashboard</h1>
          <p>Generated at {summary.generatedAt}</p>
        </div>
      </header>

      <section className="card filters">
        <h3>Filters</h3>
        <div className="filters-grid">
          <label>
            Endpoint
            <select value={filters.endpoint} onChange={(event) => setFilters((prev) => ({ ...prev, endpoint: event.target.value }))}>
              <option value="">All</option>
              {endpointsOptions.map((endpoint) => (
                <option key={endpoint} value={endpoint}>{endpoint}</option>
              ))}
            </select>
          </label>
          <label>
            Test name
            <select value={filters.testName} onChange={(event) => setFilters((prev) => ({ ...prev, testName: event.target.value }))}>
              <option value="">All</option>
              {testOptions.map((testName) => (
                <option key={testName} value={testName}>{testName}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <input type="number" value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))} placeholder="e.g. 500" />
          </label>
          <label>
            Concurrency
            <select value={filters.concurrency} onChange={(event) => setFilters((prev) => ({ ...prev, concurrency: event.target.value }))}>
              <option value="">All</option>
              {concurrencyOptions.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </label>
          <label>
            Error keyword
            <input value={filters.search} onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))} placeholder="e.g. Injected" />
          </label>
        </div>
      </section>

      <section className="stats-grid">
        <div className="card">
          <h3>Total Requests</h3>
          <p className="stat">{totals.total}</p>
        </div>
        <div className="card">
          <h3>Total Failures</h3>
          <p className="stat">{totals.failures}</p>
        </div>
        <div className="card">
          <h3>Failure Rate</h3>
          <p className="stat">{formatPercent(totals.failureRate)}</p>
        </div>
        <div className="card">
          <h3>Average Duration</h3>
          <p className="stat">{totals.avgDuration.toFixed(1)}ms</p>
        </div>
      </section>

      <LineChart title="Failure rate over time" data={timeSeries} />

      <div className="grid-two">
        <BarChart
          title="Top failing endpoints"
          data={endpoints.map((item) => ({ endpoint: item.endpoint, failures: item.failures }))}
          labelKey="endpoint"
          valueKey="failures"
        />
        <BarChart
          title="Top failing tests"
          data={tests.map((item) => ({ testName: item.testName, failures: item.failures }))}
          labelKey="testName"
          valueKey="failures"
        />
      </div>

      <BarChart
        title="Failure rate by concurrency"
        data={concurrency.map((item) => ({
          concurrency: `x${item.concurrency}`,
          failures: Number((item.failureRate * 100).toFixed(1)),
        }))}
        labelKey="concurrency"
        valueKey="failures"
      />

      <div className="grid-two">
        <Table
          title="Status codes"
          columns={[{ key: "status", label: "Status" }, { key: "count", label: "Count" }]}
          rows={statusRows}
        />
        <Table
          title="Common error messages"
          columns={[{ key: "message", label: "Message" }, { key: "count", label: "Count" }]}
          rows={errorRows}
        />
      </div>
    </div>
  );
};

export default App;
