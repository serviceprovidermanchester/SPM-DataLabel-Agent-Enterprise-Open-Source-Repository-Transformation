"use strict";
const { getDb } = require("../db");
const { fail } = require("../utils/respond");
function loadUser(req) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) return null;
  const db = getDb();
  const row = db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > datetime('now')`).get(h.slice(7));
  return row || null;
}
async function requireAuth(req, res, next) {
  req.user = loadUser(req);
  if (!req.user) return fail(res, 401, "UNAUTHORISED", "Sign in required");
  await next();
}
requireAuth.isMiddleware = true;
async function requireOwner(req, res, next) {
  req.user = loadUser(req);
  if (!req.user) return fail(res, 401, "UNAUTHORISED", "Sign in required");
  if (req.user.role !== "owner") return fail(res, 403, "FORBIDDEN", "Account owner access required");
  await next();
}
requireOwner.isMiddleware = true;
async function optionalAuth(req, res, next) { req.user = loadUser(req); await next(); }
optionalAuth.isMiddleware = true;
// The signed-in user's labelling project (owners own one; staff belong to one).
function myProject(req) {
  if (!req.user || !req.user.project_id) return null;
  return getDb().prepare("SELECT * FROM projects WHERE id = ?").get(req.user.project_id) || null;
}
module.exports = { requireAuth, requireOwner, optionalAuth, loadUser, myProject };
