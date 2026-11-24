"use strict";
// Dashboard, project profile, export records and notifications.
const { getDb } = require("../db");
const { ok, fail } = require("../utils/respond");
const { requireAuth, requireOwner, myProject } = require("../middleware/auth");
const { requireFields } = require("../middleware/validate");
const { refCode } = require("../utils/tokens");
const { schemaShape, defaultPair, agreementFor, exportSummaryFor } = require("../seed");
const { openDisagreements } = require("./labels");

const exportShape = (r) => ({ id: r.id, projectId: r.project_id, schemaId: r.schema_id,
  reference: r.reference, title: r.title, summary: r.summary, kappa: r.kappa,
  createdBy: r.created_by, createdAt: r.created_at });
const projectShape = (p) => ({ id: p.id, name: p.name, slug: p.slug, team: p.team,
  sector: p.sector, location: p.location, createdAt: p.created_at });

module.exports = [
  ["GET", "/api/v1/dashboard", requireAuth, async (req, res) => {
    const p = myProject(req); if (!p) return fail(res, 404, "NO_PROJECT", "No project is attached to this account");
    const db = getDb();
    const schemas = db.prepare("SELECT * FROM label_schemas WHERE project_id = ? ORDER BY id").all(p.id);
    let open = 0; const headlines = [];
    for (const s of schemas) {
      const pair = defaultPair(db, s.id);
      if (!pair) continue;
      const { agreement } = agreementFor(db, s, pair.a, pair.b);
      const queue = openDisagreements(db, s, pair);
      open += queue.length;
      headlines.push({ schema: schemaShape(s), kappa: agreement.kappa, po: agreement.po, pe: agreement.pe,
        interpretation: agreement.interpretation, openDisagreements: queue.length });
    }
    const headline = headlines.find((h) => h.schema.ref === "dental-triage") || headlines[0] || null;
    return ok(res, { project: projectShape(p),
      stats: { schemas: schemas.length,
        items: db.prepare("SELECT COUNT(*) AS n FROM items WHERE project_id = ?").get(p.id).n,
        annotators: db.prepare("SELECT COUNT(*) AS n FROM annotators WHERE project_id = ?").get(p.id).n,
        assignments: db.prepare("SELECT COUNT(*) AS n FROM assignments WHERE project_id = ?").get(p.id).n,
        annotations: db.prepare("SELECT COUNT(*) AS n FROM annotations WHERE project_id = ?").get(p.id).n,
        adjudications: db.prepare("SELECT COUNT(*) AS n FROM adjudications WHERE project_id = ?").get(p.id).n,
        openDisagreements: open },
      headlineAgreement: headline, schemaAgreements: headlines,
      recentExports: db.prepare("SELECT * FROM exports WHERE project_id = ? ORDER BY id DESC LIMIT 5").all(p.id).map(exportShape) });
  }],
  ["GET", "/api/v1/project", requireAuth, async (req, res) => {
    const p = myProject(req); if (!p) return fail(res, 404, "NO_PROJECT", "No project is attached to this account");
    return ok(res, { project: projectShape(p) });
  }],
  ["PUT", "/api/v1/project", requireOwner, async (req, res) => {
    const p = myProject(req); if (!p) return fail(res, 404, "NO_PROJECT", "No project is attached to this account");
    const db = getDb();
    db.prepare("UPDATE projects SET name = ?, team = ?, sector = ?, location = ? WHERE id = ?")
      .run(req.body.name || p.name, req.body.team ?? p.team, req.body.sector ?? p.sector, req.body.location ?? p.location, p.id);
    return ok(res, { project: projectShape(db.prepare("SELECT * FROM projects WHERE id = ?").get(p.id)) });
  }],
  ["GET", "/api/v1/exports", requireAuth, async (req, res) => {
    const p = myProject(req); if (!p) return fail(res, 404, "NO_PROJECT", "No project is attached to this account");
    const rows = getDb().prepare("SELECT * FROM exports WHERE project_id = ? ORDER BY id DESC").all(p.id);
    return ok(res, { exports: rows.map(exportShape) });
  }],
  ["POST", "/api/v1/exports", requireAuth, async (req, res) => {
    requireFields(req.body, ["schemaId"]);
    const p = myProject(req); if (!p) return fail(res, 404, "NO_PROJECT", "No project is attached to this account");
    const db = getDb();
    const s = db.prepare("SELECT * FROM label_schemas WHERE id = ? AND project_id = ?").get(Number(req.body.schemaId), p.id);
    if (!s) return fail(res, 404, "SCHEMA_NOT_FOUND", "Label schema not found");
    const summary = exportSummaryFor(db, s);
    const pair = defaultPair(db, s.id);
    const kappa = pair ? agreementFor(db, s, pair.a, pair.b).agreement.kappa : null;
    const dist = summary.distribution.map((d) => d.label + " " + d.count + " (" + d.percent + "%)").join(", ");
    const text = s.name + " export: " + summary.totalItems + " items — " + dist +
      ", unresolved " + summary.unresolved + " (" + summary.unresolvedPercent + "%)." +
      (kappa === null ? "" : " Headline Cohen's kappa " + kappa + " for the default annotator pair.");
    const info = db.prepare(`INSERT INTO exports (project_id, schema_id, reference, title, summary, kappa, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(p.id, s.id, refCode("EXP"), req.body.title || ("Export summary — " + s.name), text, kappa, req.user.full_name);
    return ok(res, { export: exportShape(db.prepare("SELECT * FROM exports WHERE id = ?").get(info.lastInsertRowid)),
      exportSummary: summary }, 201);
  }],
  ["GET", "/api/v1/notifications", requireAuth, async (req, res) =>
    ok(res, { notifications: getDb().prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50").all(req.user.id) })],
  ["PATCH", "/api/v1/notifications/read", requireAuth, async (req, res) => {
    getDb().prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?").run(req.user.id);
    return ok(res, { markedRead: true });
  }],
];
