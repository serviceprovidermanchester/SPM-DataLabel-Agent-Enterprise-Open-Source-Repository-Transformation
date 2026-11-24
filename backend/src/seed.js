"use strict";
// Seeds DataLabel on first start (idempotent): the showcase team
// (LabelWorks Manchester, Northern Quarter), its owner and staff accounts,
// three annotator profiles, two label schemas (18 items), assignments for
// the two annotators on every item, the seeded annotations from
// seed-data.js (so all agreement figures reconcile by hand), one export
// summary and notifications. createProject() is also used by registration,
// so a new account gets its own empty labelling workspace.
const { getDb } = require("./db");
const { PRODUCT, PROJECT, SCHEMAS, ANNOTATORS } = require("./seed-data");
const { computeAgreement, annotatorProgress, summariseFinalLabels } = require("./ai/engine");
const { hashPassword, refCode } = require("./utils/tokens");

function slugify(s) {
  return String(s || "my-project").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "my-project";
}
function uniqueSlug(db, base) {
  let slug = base, n = 2;
  while (db.prepare("SELECT id FROM projects WHERE slug = ?").get(slug)) slug = base + "-" + (n++);
  return slug;
}
function createProject(db, ownerUserId, fields) {
  const info = db.prepare(`INSERT INTO projects (owner_user_id, name, slug, team, sector, location)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .run(ownerUserId, fields.name, uniqueSlug(db, slugify(fields.slug || fields.name)),
      fields.team || "", fields.sector || "", fields.location || "");
  const projectId = info.lastInsertRowid;
  db.prepare("UPDATE users SET project_id = ? WHERE id = ?").run(projectId, ownerUserId);
  return db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId);
}
function schemaShape(s) {
  return { id: s.id, projectId: s.project_id, ref: s.ref, name: s.name, task: s.task,
    labels: JSON.parse(s.labels || "[]"), createdAt: s.created_at };
}
function itemShape(i) {
  return { id: i.id, schemaId: i.schema_id, ref: i.ref, text: i.text, source: i.source, createdAt: i.created_at };
}
function annotatorShape(a) {
  return { id: a.id, projectId: a.project_id, name: a.name, email: a.email, role: a.role, createdAt: a.created_at };
}
function insertSchema(db, projectId, def) {
  const info = db.prepare("INSERT INTO label_schemas (project_id, ref, name, task, labels) VALUES (?, ?, ?, ?, ?)")
    .run(projectId, def.ref || "", def.name, def.task || "", JSON.stringify(def.labels));
  const schemaId = info.lastInsertRowid;
  const ins = db.prepare("INSERT INTO items (schema_id, project_id, ref, text, source) VALUES (?, ?, ?, ?, ?)");
  for (const it of def.items || []) {
    const [ref, text] = Array.isArray(it) ? it : [it.ref || "", it.text];
    ins.run(schemaId, projectId, ref, text, it.source || "patient message feed");
  }
  return db.prepare("SELECT * FROM label_schemas WHERE id = ?").get(schemaId);
}
function itemsOf(db, schemaId) {
  return db.prepare("SELECT * FROM items WHERE schema_id = ? ORDER BY id").all(schemaId);
}
function assign(db, projectId, schemaId, itemId, annotatorId) {
  const info = db.prepare(`INSERT OR IGNORE INTO assignments (project_id, schema_id, item_id, annotator_id)
    VALUES (?, ?, ?, ?)`).run(projectId, schemaId, itemId, annotatorId);
  return db.prepare("SELECT * FROM assignments WHERE item_id = ? AND annotator_id = ?").get(itemId, annotatorId);
}
function annotate(db, projectId, assignment, label, note) {
  db.prepare(`INSERT INTO annotations (project_id, assignment_id, item_id, annotator_id, label, note)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(assignment_id) DO UPDATE SET label = excluded.label, note = excluded.note`)
    .run(projectId, assignment.id, assignment.item_id, assignment.annotator_id, label, note || "");
  db.prepare("UPDATE assignments SET status = 'completed' WHERE id = ?").run(assignment.id);
  return db.prepare("SELECT * FROM annotations WHERE assignment_id = ?").get(assignment.id);
}
// Doubly-labelled pairs for two annotators on one schema, in item order.
function pairsFor(db, schemaId, annotatorAId, annotatorBId) {
  const rows = db.prepare(`SELECT i.ref AS ref,
      (SELECT label FROM annotations WHERE item_id = i.id AND annotator_id = ?) AS la,
      (SELECT label FROM annotations WHERE item_id = i.id AND annotator_id = ?) AS lb
    FROM items i WHERE i.schema_id = ? ORDER BY i.id`).all(annotatorAId, annotatorBId, schemaId);
  return rows.filter((r) => r.la && r.lb)
    .map((r) => ({ itemRef: r.ref, labelA: r.la, labelB: r.lb }));
}
// The default agreement pair: the first two 'annotator'-role profiles (by
// id) that hold assignments on this schema.
function defaultPair(db, schemaId) {
  const rows = db.prepare(`SELECT DISTINCT a.annotator_id AS id FROM assignments a
    JOIN annotators an ON an.id = a.annotator_id
    WHERE a.schema_id = ? AND an.role = 'annotator' ORDER BY a.annotator_id`).all(schemaId);
  if (rows.length < 2) return null;
  return { a: rows[0].id, b: rows[1].id };
}
function agreementFor(db, schema, annotatorAId, annotatorBId) {
  const labels = JSON.parse(schema.labels || "[]");
  const pairs = pairsFor(db, schema.id, annotatorAId, annotatorBId);
  const agreement = computeAgreement(pairs, labels);
  const nameOf = (id) => (db.prepare("SELECT * FROM annotators WHERE id = ?").get(id) || {}).name || "";
  const progressOf = (id) => {
    const total = db.prepare("SELECT COUNT(*) AS n FROM assignments WHERE schema_id = ? AND annotator_id = ?").get(schema.id, id).n;
    const done = db.prepare("SELECT COUNT(*) AS n FROM assignments WHERE schema_id = ? AND annotator_id = ? AND status = 'completed'").get(schema.id, id).n;
    return { annotatorId: id, name: nameOf(id), ...annotatorProgress(done, total) };
  };
  return { schema: schemaShape(schema),
    annotatorA: { id: annotatorAId, name: nameOf(annotatorAId) },
    annotatorB: { id: annotatorBId, name: nameOf(annotatorBId) },
    agreement, progress: [progressOf(annotatorAId), progressOf(annotatorBId)] };
}
function exportSummaryFor(db, schema) {
  const labels = JSON.parse(schema.labels || "[]");
  const items = itemsOf(db, schema.id);
  const anns = {};
  for (const r of db.prepare("SELECT i.ref AS ref, a.label AS label FROM annotations a JOIN items i ON i.id = a.item_id WHERE i.schema_id = ? ORDER BY a.id").all(schema.id)) {
    (anns[r.ref] = anns[r.ref] || []).push(r.label);
  }
  const adjs = {};
  for (const r of db.prepare("SELECT i.ref AS ref, ad.final_label AS fl FROM adjudications ad JOIN items i ON i.id = ad.item_id WHERE ad.schema_id = ?").all(schema.id)) {
    adjs[r.ref] = r.fl;
  }
  return { schema: schemaShape(schema), ...summariseFinalLabels(items.map(itemShape), anns, adjs, labels) };
}
function seed() {
  const db = getDb();
  if (db.prepare("SELECT COUNT(*) AS n FROM users").get().n > 0) return;
  const owner = db.prepare("INSERT INTO users (full_name, email, role, password_hash) VALUES (?, ?, 'owner', ?)")
    .run(PRODUCT.ownerName, PRODUCT.ownerEmail, hashPassword(PRODUCT.ownerPassword));
  const ownerId = owner.lastInsertRowid;
  const project = createProject(db, ownerId, PROJECT);
  const pid = project.id;
  db.prepare("INSERT INTO users (full_name, email, role, project_id, password_hash) VALUES (?, ?, 'staff', ?, ?)")
    .run(PRODUCT.staffName, PRODUCT.staffEmail, pid, hashPassword(PRODUCT.staffPassword));
  const annotators = ANNOTATORS.map((a) => {
    const info = db.prepare("INSERT INTO annotators (project_id, name, email, role) VALUES (?, ?, ?, ?)")
      .run(pid, a.name, a.email, a.role);
    return db.prepare("SELECT * FROM annotators WHERE id = ?").get(info.lastInsertRowid);
  });
  const [zara, callum] = annotators;
  const schemas = SCHEMAS.map((def) => {
    const schema = insertSchema(db, pid, def);
    const items = itemsOf(db, schema.id);
    const byRef = Object.fromEntries(items.map((i) => [i.ref, i]));
    // Both annotators are assigned every item in the schema.
    const assignments = {};
    for (const it of items) {
      assignments["z:" + it.ref] = assign(db, pid, schema.id, it.id, zara.id);
      assignments["c:" + it.ref] = assign(db, pid, schema.id, it.id, callum.id);
    }
    for (const [ref, lz, lc] of def.annotations) {
      if (lz) annotate(db, pid, assignments["z:" + ref], lz, "");
      if (lc) annotate(db, pid, assignments["c:" + ref], lc, "");
    }
    return schema;
  });
  const triage = agreementFor(db, schemas[0], zara.id, callum.id);
  db.prepare(`INSERT INTO exports (project_id, schema_id, reference, title, summary, kappa, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(pid, schemas[0].id, refCode("EXP"), "Export summary — Dental Triage (before adjudication)",
      "Dental Triage export: 10 items — urgent 4 (40%), routine 4 (40%), unresolved 2 (20%). " +
      "Inter-annotator agreement po 0.8, pe 0.5, Cohen's kappa 0.6 (moderate) across Zara Ahmed and Callum Reid.",
      triage.agreement.kappa, PRODUCT.ownerName);
  db.prepare("INSERT INTO notifications (user_id, type, title, body) VALUES (?, 'agreement', ?, ?)")
    .run(ownerId, "Dental Triage kappa is 0.6",
      "Zara Ahmed and Callum Reid agree on 8 of 10 triage items (po 0.8, pe 0.5). Two disagreements wait in the review queue: DL-05 and DL-06.");
  db.prepare("INSERT INTO notifications (user_id, type, title, body) VALUES (?, 'system', ?, ?)")
    .run(ownerId, "Welcome to DataLabel", "Your Dental Triage and Ticket Intent schemas are ready, with 18 seeded items across two annotators.");
}
module.exports = { seed, createProject, slugify, insertSchema, schemaShape, itemShape, annotatorShape,
  itemsOf, assign, annotate, pairsFor, defaultPair, agreementFor, exportSummaryFor };
