"use strict";
const { getDb } = require("../db");
const { ok, fail } = require("../utils/respond");
const { token, hashPassword, verifyPassword } = require("../utils/tokens");
const { requireAuth } = require("../middleware/auth");
const { requireFields } = require("../middleware/validate");
const { createProject } = require("../seed");
const pub = (u) => ({ id: u.id, fullName: u.full_name, email: u.email, phone: u.phone, role: u.role, projectId: u.project_id });
function startSession(db, userId) {
  const t = token();
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))").run(t, userId);
  return t;
}
module.exports = [
  ["POST", "/api/v1/auth/register", async (req, res) => {
    requireFields(req.body, ["fullName", "email", "password", "projectName"]);
    if (String(req.body.password).length < 8) return fail(res, 400, "WEAK_PASSWORD", "Password must be at least 8 characters");
    const db = getDb();
    if (db.prepare("SELECT id FROM users WHERE email = ?").get(String(req.body.email).toLowerCase()))
      return fail(res, 409, "EMAIL_TAKEN", "An account with that email already exists");
    const info = db.prepare("INSERT INTO users (full_name, email, phone, role, password_hash) VALUES (?, ?, ?, 'owner', ?)")
      .run(req.body.fullName, String(req.body.email).toLowerCase(), req.body.phone || "", hashPassword(req.body.password));
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
    const project = createProject(db, user.id, { name: req.body.projectName, team: req.body.team || "",
      sector: req.body.sector || "", location: req.body.location || "" });
    const fresh = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
    return ok(res, { token: startSession(db, user.id), user: pub(fresh),
      project: { id: project.id, name: project.name, slug: project.slug, team: project.team } }, 201);
  }],
  ["POST", "/api/v1/auth/login", async (req, res) => {
    requireFields(req.body, ["email", "password"]);
    const db = getDb();
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(String(req.body.email).toLowerCase());
    if (!user || !verifyPassword(req.body.password, user.password_hash))
      return fail(res, 401, "INVALID_CREDENTIALS", "Email or password not recognised");
    return ok(res, { token: startSession(db, user.id), user: pub(user) });
  }],
  ["POST", "/api/v1/auth/logout", requireAuth, async (req, res) => {
    getDb().prepare("DELETE FROM sessions WHERE token = ?").run((req.headers.authorization || "").slice(7));
    return ok(res, { signedOut: true });
  }],
  ["GET", "/api/v1/auth/me", requireAuth, async (req, res) => ok(res, { user: pub(req.user) })],
  ["PUT", "/api/v1/auth/me", requireAuth, async (req, res) => {
    const db = getDb();
    db.prepare("UPDATE users SET full_name = ?, phone = ? WHERE id = ?")
      .run(req.body.fullName || req.user.full_name, req.body.phone ?? req.user.phone, req.user.id);
    return ok(res, { user: pub(db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id)) });
  }],
];
