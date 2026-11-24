"use strict";
// DataLabel API + console server. Zero-dependency: node:http, node:sqlite, node:crypto.
// Start: node src/server.js (PORT env, default 4000). Serves the console at /.
const http = require("node:http");
const { createApp } = require("./app");
const { PRODUCT } = require("./seed-data");
const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.HOST || "0.0.0.0";
const server = http.createServer(createApp());
server.listen(PORT, HOST, () => {
  console.log(PRODUCT.name + " listening on http://" + HOST + ":" + PORT);
  console.log("Console: http://" + HOST + ":" + PORT + "/ - Health: GET /health");
});
process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.on("SIGINT", () => server.close(() => process.exit(0)));
