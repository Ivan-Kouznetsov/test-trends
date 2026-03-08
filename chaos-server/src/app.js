const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();

app.disable("x-powered-by");
app.use(cors());
app.use(bodyParser.json({ limit: "1mb" }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.text({ type: "text/*" }));

const parsePercentage = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
    return null;
  }
  return parsed;
};

const parseStatusCode = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 100 || parsed > 599) {
    return null;
  }
  return parsed;
};

const shouldFail = (percentage) => Math.random() * 100 < percentage;

const sendMirror = (res, status, body) => {
  res.status(status);
  if (body === undefined) {
    return res.end();
  }
  if (Buffer.isBuffer(body)) {
    return res.send(body);
  }
  if (typeof body === "object") {
    return res.json(body);
  }
  return res.send(body);
};

let oddEvenCounter = 0;

app.post("/odd-even", (req, res) => {
  oddEvenCounter += 1;
  const isOdd = oddEvenCounter % 2 === 1;
  if (isOdd) {
    return res.status(500).json({ error: "Injected error (odd request)" });
  }
  return sendMirror(res, 200, req.body);
});

app.post("/static/mirror", (req, res) => sendMirror(res, 200, req.body));

app.post("/:percentage/mirror", (req, res) => {
  const percentage = parsePercentage(req.params.percentage);
  if (percentage === null) {
    return res.status(400).json({ error: "Invalid percentage (0-100 expected)" });
  }

  if (shouldFail(percentage)) {
    return res.status(500).json({ error: "Injected error" });
  }

  return sendMirror(res, 200, req.body);
});

app.post("/:percentage/connection", (req, res) => {
  const percentage = parsePercentage(req.params.percentage);
  if (percentage === null) {
    return res.status(400).json({ error: "Invalid percentage (0-100 expected)" });
  }

  if (shouldFail(percentage)) {
    req.socket.destroy();
    return;
  }

  res.sendStatus(200);
});

app.post("/:percentage/:statuscode", (req, res) => {
  const percentage = parsePercentage(req.params.percentage);
  const statusCode = parseStatusCode(req.params.statuscode);

  if (percentage === null) {
    return res.status(400).json({ error: "Invalid percentage (0-100 expected)" });
  }

  if (statusCode === null) {
    return res.status(400).json({ error: "Invalid status code (100-599 expected)" });
  }

  if (shouldFail(percentage)) {
    return res.status(500).json({ error: "Injected error" });
  }

  return sendMirror(res, statusCode, req.body);
});

app.use((req, res) => res.status(404).json({ error: "Not found" }));

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  return res.status(500).json({ error: "Unexpected server error" });
});

module.exports = { app };
