"use strict";
// Label schemas, items, annotators, assignments, annotations, agreement,
// disagreements, adjudications and export summaries — the core DataLabel
// domain. All reads are scoped to the caller's project; another project's
// rows return 404.
const { getDb } = require("../db");
const { ok, fail } = require("../utils/respond");
const { requireAuth, myProject } = require("../middleware/auth");
const { requireFields } = require("../middleware/validate");
const { schemaShape, itemShape, annotatorShape, itemsOf, assign, annotate,
  defaultPair, agreementFor, exportSummaryFor } = require("../seed");
const { annotatorProgress } = require("../ai/engine");

function mySchema(db, projectId, id) {
  return db.prepare("SELECT * FROM label_schemas WHERE id = ? AND project_id = ?").get(Number(id), projectId) || null;
}
function myAnnotator(db, projectId, id) {
  return db.prepare("SELECT * FROM annotators WHERE id = ? AND project_id = ?").get(Number(id), projectId) || null;
}
function progressOverall(db, annotatorId) {
  const total = db.prepare("SELECT COUNT(*) AS n FROM assignments WHERE annotator_id = ?").get(annotatorId).n;
  const done = db.prepare("SELECT COUNT(*) AS n FROM assignments WHERE annotator_id = ? AND status = 'completed'").get(annotatorId).n;
  return annotatorProgress(done, total);
}
function itemDetail(db, item) {
  const assignments = db.prepare(`SELECT a.*, an.name AS annotator_name FROM assignments a
    JOIN annotators an ON an.id = a.annotator_id WHERE a.item_id = ? ORDER BY a.annotator_id`).all(item.id)
    .map((a) => ({ id: a.id, annotatorId: a.annotator_id, annotatorName: a.annotator_name, status: a.status }));
  const annotations = db.prepare(`SELECT a.*, an.name AS annotator_name FROM annotations a
    JOIN annotators an ON an.id = a.annotator_id WHERE a.item_id = ? ORDER BY a.annotator_id`).all(item.id)
    .map((a) => ({ id: a.id, annotatorId: a.annotator_id, annotatorName: a.annotator_name, label: a.label, note: a.note }));
  const adj = db.prepare("SELECT * FROM adjudications WHERE item_id = ?").get(item.id);
  return { item: itemShape(item), assignments, annotations,
    adjudication: adj ? { id: adj.id, finalLabel: adj.final_label, adjudicator: adj.adjudicator, note: adj.note } : null };
}
function openDisagreements(db, schema, pair) {
  const { agreement } = agreementFor(db, schema, pair.a, pair.b);
  const adjudicated = new Set(db.prepare("SELECT item_id FROM adjudications WHERE schema_id = ?").all(schema.id).map((r) => r.item_id));
  const byRef = Object.fromEntries(itemsOf(db, schema.id).map((i) => [i.ref, i]));
  return agreement.disagreements
    .filter((d) => byRef[d.itemRef] && !adjudicated.has(byRef[d.itemRef].id))
    .map((d) => ({ ...d, itemId: byRef[d.itemRef].id, text: byRef[d.itemRef].text }));
}

module.exports = [
  // ---- Label schemas ----
  ["GET", "/api/v1/schemas", requireAuth, async (req, res) => {
    const p = myProject(req); if (!p) return fail(res, 404, "NO_PROJECT", "No project is attached to this account");
    const db = getDb();
    const rows = db.prepare("SELECT * FROM label_schemas WHERE project_id = ? ORDER BY id").all(p.id);
    return ok(res, { schemas: rows.map((s) => ({ ...schemaShape(s),
      itemCount: db.prepare("SELECT COUNT(*) AS n FROM items WHERE schema_id = ?").get(s.id).n,
      annotationCount: db.prepare("SELECT COUNT(*) AS n FROM annotations a JOIN items i ON i.id = a.item_id WHERE i.schema_id = ?").get(s.id).n })) });
  }],
  ["POST", "/api/v1/schemas", requireAuth, async (req, res) => {
    requireFields(req.body, ["name", "labels"]);
    const p = myProject(req); if (!p) return fail(res, 404, "NO_PROJECT", "No project is attached to this account");
    const labels = Array.isArray(req.body.labels) ? req.body.labels.map(String).filter(Boolean) : [];
    if (labels.length < 2) return fail(res, 400, "BAD_LABELS", "A label schema needs at least two labels");
    const db = getDb();
    const items = (req.body.items || []).map((c, i) => ({ ref: c.ref || ("ITEM-" + String(i + 1).padStart(2, "0")),
      text: c.text, source: c.source || "patient message feed" }));
    for (const c of items) if (!c.text) return fail(res, 400, "BAD_ITEM", "Every item needs text");
    const { insertSchema } = require("../seed");
    const schema = insertSchema(db, p.id, { ref: req.body.ref || "", name: req.body.name, task: req.body.task || "", labels, items });
    return ok(res, { schema: { ...schemaShape(schema), itemCount: items.length } }, 201);
  }],
  ["GET", "/api/v1/schemas/:id", requireAuth, async (req, res, params) => {
    const p = myProject(req); if (!p) return fail(res, 404, "NO_PROJECT", "No project is attached to this account");
    const db = getDb();
    const s = mySchema(db, p.id, params.id);
    if (!s) return fail(res, 404, "SCHEMA_NOT_FOUND", "Label schema not found");
    return ok(res, { schema: schemaShape(s), items: itemsOf(db, s.id).map(itemShape) });
  }],
  ["POST", "/api/v1/schemas/:id/items", requireAuth, async (req, res, params) => {
    requireFields(req.body, ["text"]);
    const p = myProject(req); if (!p) return fail(res, 404, "NO_PROJECT", "No project is attached to this account");
    const db = getDb();
    const s = mySchema(db, p.id, params.id);
    if (!s) return fail(res, 404, "SCHEMA_NOT_FOUND", "Label schema not found");
    const n = db.prepare("SELECT COUNT(*) AS n FROM items WHERE schema_id = ?").get(s.id).n;
    const info = db.prepare("INSERT INTO items (schema_id, project_id, ref, text, source) VALUES (?, ?, ?, ?, ?)")
      .run(s.id, p.id, req.body.ref || ("ITEM-" + String(n + 1).padStart(2, "0")), req.body.text, req.body.source || "patient message feed");
    return ok(res, { item: itemShape(db.prepare("SELECT * FROM items WHERE id = ?").get(info.lastInsertRowid)) }, 201);
  }],
  // ---- Annotators ----
  ["GET", "/api/v1/annotators", requireAuth, async (req, res) => {
    const p = myProject(req); if (!p) return fail(res, 404, "NO_PROJECT", "No project is attached to this account");
    const db = getDb();
    const rows = db.prepare("SELECT * FROM annotators WHERE project_id = ? ORDER BY id").all(p.id);
    return ok(res, { annotators: rows.map((a) => ({ ...annotatorShape(a), progress: progressOverall(db, a.id) })) });
  }],
  ["POST", "/api/v1/annotators", requireAuth, async (req, res) => {
    requireFields(req.body, ["name"]);
    const p = myProject(req); if (!p) return fail(res, 404, "NO_PROJECT", "No project is attached to this account");
    const role = req.body.role || "annotator";
    if (!["annotator", "adjudicator"].includes(role)) return fail(res, 400, "BAD_ROLE", "Role must be annotator or adjudicator");
    const db = getDb();
    const info = db.prepare("INSERT INTO annotators (project_id, name, email, role) VALUES (?, ?, ?, ?)")
      .run(p.id, req.body.name, req.body.email || "", role);
    const a = db.prepare("SELECT * FROM annotators WHERE id = ?").get(info.lastInsertRowid);
    return ok(res, { annotator: { ...annotatorShape(a), progress: progressOverall(db, a.id) } }, 201);
  }],
  // ---- Items ----
  ["GET", "/api/v1/items", requireAuth, async (req, res) => {
    const p = myProject(req); if (!p) return fail(res, 404, "NO_PROJECT", "No project is attached to this account");
    const db = getDb();
    let rows = db.prepare("SELECT * FROM items WHERE project_id = ? ORDER BY id").all(p.id);
    if (req.query.schemaId) rows = rows.filter((r) => r.schema_id === Number(req.query.schemaId));
    return ok(res, { items: rows.map((i) => ({ ...itemShape(i),
      annotationCount: db.prepare("SELECT COUNT(*) AS n FROM annotations WHERE item_id = ?").get(i.id).n })) });
  }],
  ["GET", "/api/v1/items/:id", requireAuth, async (req, res, params) => {
    const p = myProject(req); if (!p) return fail(res, 404, "NO_PROJECT", "No project is attached to this account");
    const db = getDb();
    const item = db.prepare("SELECT * FROM items WHERE id = ? AND project_id = ?").get(Number(params.id), p.id);
    if (!item) return fail(res, 404, "ITEM_NOT_FOUND", "Item not found");
    return ok(res, itemDetail(db, item));
  }],
  // ---- Assignments & annotations ----
  ["POST", "/api/v1/assignments", requireAuth, async (req, res) => {
    requireFields(req.body, ["itemId", "annotatorId"]);
    const p = myProject(req); if (!p) return fail(res, 404, "NO_PROJECT", "No project is attached to this account");
    const db = getDb();
    const item = db.prepare("SELECT * FROM items WHERE id = ? AND project_id = ?").get(Number(req.body.itemId), p.id);
    if (!item) return fail(res, 404, "ITEM_NOT_FOUND", "Item not found");
    const annotator = myAnnotator(db, p.id, req.body.annotatorId);
    if (!annotator) return fail(res, 404, "ANNOTATOR_NOT_FOUND", "Annotator not found");
    const a = assign(db, p.id, item.schema_id, item.id, annotator.id);
    return ok(res, { assignment: { id: a.id, itemId: a.item_id, annotatorId: a.annotator_id, status: a.status } }, 201);
  }],
  ["POST", "/api/v1/annotations", requireAuth, async (req, res) => {
    requireFields(req.body, ["assignmentId", "label"]);
    const p = myProject(req); if (!p) return fail(res, 404, "NO_PROJECT", "No project is attached to this account");
    const db = getDb();
    const a = db.prepare("SELECT * FROM assignments WHERE id = ? AND project_id = ?").get(Number(req.body.assignmentId), p.id);
    if (!a) return fail(res, 404, "ASSIGNMENT_NOT_FOUND", "Assignment not found");
    const schema = mySchema(db, p.id, a.schema_id);
    const labels = JSON.parse(schema.labels || "[]");
    if (!labels.includes(req.body.label))
      return fail(res, 400, "BAD_LABEL", "Label must be one of: " + labels.join(", "));
    const ann = annotate(db, p.id, a, req.body.label, req.body.note || "");
    const total = db.prepare("SELECT COUNT(*) AS n FROM assignments WHERE schema_id = ? AND annotator_id = ?").get(a.schema_id, a.annotator_id).n;
    const done = db.prepare("SELECT COUNT(*) AS n FROM assignments WHERE schema_id = ? AND annotator_id = ? AND status = 'completed'").get(a.schema_id, a.annotator_id).n;
    return ok(res, { annotation: { id: ann.id, assignmentId: ann.assignment_id, itemId: ann.item_id,
      annotatorId: ann.annotator_id, label: ann.label, note: ann.note },
      progress: annotatorProgress(done, total) }, 201);
  }],
  // ---- Agreement, disagreements, adjudication, export ----
  ["GET", "/api/v1/schemas/:id/agreement", requireAuth, async (req, res, params) => {
    const p = myProject(req); if (!p) return fail(res, 404, "NO_PROJECT", "No project is attached to this account");
    const db = getDb();
    const s = mySchema(db, p.id, params.id);
    if (!s) return fail(res, 404, "SCHEMA_NOT_FOUND", "Label schema not found");
    let pair = null;
    if (req.query.annotatorA && req.query.annotatorB) {
      const a = myAnnotator(db, p.id, req.query.annotatorA), b = myAnnotator(db, p.id, req.query.annotatorB);
      if (!a || !b) return fail(res, 404, "ANNOTATOR_NOT_FOUND", "Annotator not found");
      pair = { a: a.id, b: b.id };
    } else pair = defaultPair(db, s.id);
    if (!pair) return fail(res, 400, "NO_PAIR", "This schema needs assignments for two annotators before agreement can be measured");
    return ok(res, agreementFor(db, s, pair.a, pair.b));
  }],
  ["GET", "/api/v1/schemas/:id/disagreements", requireAuth, async (req, res, params) => {
    const p = myProject(req); if (!p) return fail(res, 404, "NO_PROJECT", "No project is attached to this account");
    const db = getDb();
    const s = mySchema(db, p.id, params.id);
    if (!s) return fail(res, 404, "SCHEMA_NOT_FOUND", "Label schema not found");
    const pair = defaultPair(db, s.id);
    if (!pair) return ok(res, { schema: schemaShape(s), disagreements: [] });
    return ok(res, { schema: schemaShape(s), disagreements: openDisagreements(db, s, pair) });
  }],
  ["POST", "/api/v1/adjudications", requireAuth, async (req, res) => {
    requireFields(req.body, ["itemId", "finalLabel"]);
    const p = myProject(req); if (!p) return fail(res, 404, "NO_PROJECT", "No project is attached to this account");
    const db = getDb();
    const item = db.prepare("SELECT * FROM items WHERE id = ? AND project_id = ?").get(Number(req.body.itemId), p.id);
    if (!item) return fail(res, 404, "ITEM_NOT_FOUND", "Item not found");
    const schema = mySchema(db, p.id, item.schema_id);
    const labels = JSON.parse(schema.labels || "[]");
    if (!labels.includes(req.body.finalLabel))
      return fail(res, 400, "BAD_LABEL", "Final label must be one of: " + labels.join(", "));
    const adjudicator = req.body.adjudicator || req.user.full_name;
    db.prepare(`INSERT INTO adjudications (project_id, schema_id, item_id, final_label, adjudicator, note)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(item_id) DO UPDATE SET final_label = excluded.final_label, adjudicator = excluded.adjudicator, note = excluded.note`)
      .run(p.id, schema.id, item.id, req.body.finalLabel, adjudicator, req.body.note || "");
    const adj = db.prepare("SELECT * FROM adjudications WHERE item_id = ?").get(item.id);
    const pair = defaultPair(db, schema.id);
    return ok(res, { adjudication: { id: adj.id, itemId: adj.item_id, schemaId: adj.schema_id,
        finalLabel: adj.final_label, adjudicator: adj.adjudicator, note: adj.note },
      exportSummary: exportSummaryFor(db, schema),
      openDisagreements: pair ? openDisagreements(db, schema, pair).length : 0 }, 201);
  }],
  ["GET", "/api/v1/schemas/:id/export-summary", requireAuth, async (req, res, params) => {
    const p = myProject(req); if (!p) return fail(res, 404, "NO_PROJECT", "No project is attached to this account");
    const db = getDb();
    const s = mySchema(db, p.id, params.id);
    if (!s) return fail(res, 404, "SCHEMA_NOT_FOUND", "Label schema not found");
    return ok(res, exportSummaryFor(db, s));
  }],
];
module.exports.itemDetail = itemDetail;
module.exports.openDisagreements = openDisagreements;
