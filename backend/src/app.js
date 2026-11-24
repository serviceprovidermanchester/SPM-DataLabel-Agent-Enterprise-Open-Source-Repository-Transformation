"use strict";
// HTTP application: explicit router over node:http; also serves the web
// console from ../../web. Routes are declared in src/routes/*.js as
// [method, pattern, ...handlers]; patterns support :params.
const fs = require("node:fs");
const path = require("node:path");
const { getDb } = require("./db");
const { seed } = require("./seed");
const { sendJson, ok, fail, serveStatic } = require("./utils/respond");
const { handleError } = require("./middleware/errors");
const { PRODUCT } = require("./seed-data");
const WEB_DIR = path.join(__dirname, "..", "..", "web");
const routeModules = [require("./routes/auth"), require("./routes/labels"), require("./routes/misc")];
const routes = [];
for (const mod of routeModules) for (const e of mod) if (Array.isArray(e)) routes.push({ method: e[0], pattern: e[1], handlers: e.slice(2) });
function match(pattern, pathname) {
  const p = pattern.split("/").filter(Boolean), a = pathname.split("/").filter(Boolean);
  if (p.length !== a.length) return null;
  const params = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(":")) params[p[i].slice(1)] = decodeURIComponent(a[i]);
    else if (p[i] !== a[i]) return null;
  }
  return params;
}
async function runHandlers(handlers, req, res, params) {
  let i = 0;
  async function next() {
    const h = handlers[i++]; if (!h) return;
    if (h.isMiddleware) { await h(req, res, async () => { await next(); }); return; }
    await h(req, res, params);
  }
  await next();
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ""; req.on("data", (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch { const e = new Error("Invalid JSON body"); e.status = 400; e.code = "BAD_JSON"; reject(e); } });
    req.on("error", reject);
  });
}
function createApp() {
  getDb(); seed();
  return async function app(req, res) {
    try {
      const url = new URL(req.url, "http://localhost");
      req.query = Object.fromEntries(url.searchParams.entries());
      if (req.method === "OPTIONS") return sendJson(res, 204, {});
      if (url.pathname === "/health") {
        const projects = getDb().prepare("SELECT COUNT(*) AS n FROM projects").get().n;
        const schemas = getDb().prepare("SELECT COUNT(*) AS n FROM label_schemas").get().n;
        const items = getDb().prepare("SELECT COUNT(*) AS n FROM items").get().n;
        const annotations = getDb().prepare("SELECT COUNT(*) AS n FROM annotations").get().n;
        return ok(res, { service: PRODUCT.serviceId, status: "healthy", projectsLoaded: projects,
          schemasLoaded: schemas, itemsLoaded: items, annotationsLoaded: annotations, time: new Date().toISOString() });
      }
      req.body = ["POST", "PUT", "PATCH"].includes(req.method) ? await readBody(req) : {};
      for (const route of routes) {
        if (route.method !== req.method) continue;
        const params = match(route.pattern, url.pathname);
        if (params) { await runHandlers(route.handlers, req, res, params); return; }
      }
      if (req.method === "GET" && serveStatic(req, res, WEB_DIR, url.pathname)) return;
      return fail(res, 404, "NOT_FOUND", "Route not found: " + req.method + " " + url.pathname);
    } catch (err) { return handleError(res, err); }
  };
}
module.exports = { createApp, routes };
