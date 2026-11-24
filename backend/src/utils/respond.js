"use strict";
const fs = require("node:fs");
const path = require("node:path");
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" });
  res.end(body);
}
const ok = (res, data, status = 200) => sendJson(res, status, { data });
const fail = (res, status, code, message) => sendJson(res, status, { error: { code, message } });
const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".svg": "image/svg+xml" };
function serveStatic(req, res, webDir, pathname) {
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
  const file = path.join(webDir, rel);
  if (!file.startsWith(webDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return false;
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
  res.end(fs.readFileSync(file));
  return true;
}
module.exports = { sendJson, ok, fail, serveStatic };
