"use strict";
/* Live end-to-end tests for DataLabel. Starts the real server against a
   FRESH temporary database and exercises the product over HTTP: accounts,
   the seeded showcase workspace with exact expected values, and labelled
   expected-output cases (DL-01…) whose agreement figures are computed by
   hand from the fixtures — e.g. the canonical Dental Triage schema has
   Zara Ahmed and Callum Reid agreeing on 8 of 10 items (po = 0.8) with
   5/5 label marginals each, so pe = 0.5 x 0.5 + 0.5 x 0.5 = 0.5 and
   Cohen's kappa = (0.8 - 0.5) / (1 - 0.5) = 0.6 exactly. Expected values
   are written as literal fractions here, never copied from engine output.
   Run: node tests/run-tests.js — non-zero exit on failure. */
const { spawn } = require("node:child_process");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const PORT = 4547;
const BASE = "http://127.0.0.1:" + PORT;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "datalabel-test-"));
const DB = path.join(tmp, "test.sqlite");
let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log("PASS  " + name + (detail ? " - " + detail : "")); }
  else { failed++; console.log("FAIL  " + name + (detail ? " - " + detail : "")); }
}
async function req(method, p, token, body) {
  const res = await fetch(BASE + p, { method, headers: { "Content-Type": "application/json",
    ...(token ? { Authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const r4 = (n) => Math.round((n + Number.EPSILON) * 10000) / 10000;
(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, "..", "backend", "src", "server.js")],
    { env: { ...process.env, PORT: String(PORT), DB_PATH: DB }, stdio: "pipe" });
  let up = false;
  for (let i = 0; i < 50 && !up; i++) { try { const r = await fetch(BASE + "/health"); up = r.ok; } catch { await sleep(200); } }
  if (!up) { console.log("FAIL  server did not start"); process.exit(1); }
  try {
    // ---- Seeded showcase workspace: exact expected values ----
    const health = await req("GET", "/health");
    check("health reports 1 project, 2 schemas, 18 items, 30 annotations",
      health.json.data.projectsLoaded === 1 && health.json.data.schemasLoaded === 2 &&
      health.json.data.itemsLoaded === 18 && health.json.data.annotationsLoaded === 30,
      "schemas=" + health.json.data.schemasLoaded + ", items=" + health.json.data.itemsLoaded + ", annotations=" + health.json.data.annotationsLoaded);
    const login = await req("POST", "/api/v1/auth/login", null, { email: "owner@labelworks.co.uk", password: "Owner2026!" });
    check("seeded owner can sign in", login.status === 200, "owner@labelworks.co.uk");
    const T = login.json.data.token;
    check("wrong password rejected", (await req("POST", "/api/v1/auth/login", null, { email: "owner@labelworks.co.uk", password: "nope" })).status === 401, "HTTP 401");
    check("schemas need sign-in", (await req("GET", "/api/v1/schemas")).status === 401, "HTTP 401");
    const dash = (await req("GET", "/api/v1/dashboard", T)).json.data;
    check("dashboard stats: 2 schemas, 18 items, 3 annotators, 36 assignments, 30 annotations, 3 open disagreements",
      dash.stats.schemas === 2 && dash.stats.items === 18 && dash.stats.annotators === 3 &&
      dash.stats.assignments === 36 && dash.stats.annotations === 30 && dash.stats.openDisagreements === 3 &&
      dash.stats.adjudications === 0, JSON.stringify(dash.stats));
    check("dashboard headline is the triage kappa 0.6 (moderate)",
      dash.headlineAgreement.kappa === 0.6 && dash.headlineAgreement.po === 0.8 &&
      dash.headlineAgreement.pe === 0.5 && dash.headlineAgreement.interpretation === "moderate",
      "kappa=" + dash.headlineAgreement.kappa);
    const schemas = (await req("GET", "/api/v1/schemas", T)).json.data.schemas;
    const triage = schemas.find((s) => s.ref === "dental-triage");
    const intent = schemas.find((s) => s.ref === "ticket-intent");
    check("triage schema holds 10 items / 20 annotations and intent 8 items / 10 annotations",
      triage.itemCount === 10 && triage.annotationCount === 20 && intent.itemCount === 8 && intent.annotationCount === 10 &&
      triage.labels.join(",") === "urgent,routine" && intent.labels.join(",") === "billing,booking,clinical",
      "triage=" + triage.itemCount + "/" + triage.annotationCount + ", intent=" + intent.itemCount + "/" + intent.annotationCount);
    const triageDetail = (await req("GET", "/api/v1/schemas/" + triage.id, T)).json.data;
    check("triage detail lists DL-01..DL-10 in order",
      triageDetail.items.length === 10 && triageDetail.items[0].ref === "DL-01" && triageDetail.items[9].ref === "DL-10",
      triageDetail.items[0].ref + ".." + triageDetail.items[9].ref);
    const annotators = (await req("GET", "/api/v1/annotators", T)).json.data.annotators;
    check("three annotator profiles are seeded (2 annotators + 1 adjudicator)",
      annotators.length === 3 && annotators.filter((a) => a.role === "annotator").length === 2 &&
      annotators.find((a) => a.name === "Priya Shah").role === "adjudicator",
      annotators.map((a) => a.name).join(","));

    // ---- Canonical agreement fixture (Dental Triage) ----
    const ag = (await req("GET", "/api/v1/schemas/" + triage.id + "/agreement", T)).json.data;
    const a = ag.agreement;
    const byLabel = Object.fromEntries(a.perLabel.map((r) => [r.label, r]));
    check("DL-01 observed agreement po is exactly 8/10 = 0.8",
      a.po === 0.8 && a.agreed === 8 && a.disagreed === 2 && a.items === 10, "po=" + a.po + ", agreed=" + a.agreed);
    check("DL-02 marginals are 0.5/0.5 for both annotators, so pe = 0.25 + 0.25 = 0.5",
      byLabel.urgent.countA === 5 && byLabel.urgent.countB === 5 && byLabel.routine.countA === 5 && byLabel.routine.countB === 5 &&
      byLabel.urgent.marginalA === 0.5 && byLabel.urgent.peContribution === 0.25 &&
      byLabel.routine.peContribution === 0.25 && a.pe === 0.5, "pe=" + a.pe);
    check("DL-03 Cohen's kappa is exactly (0.8 - 0.5) / (1 - 0.5) = 0.6, band moderate",
      a.kappa === r4((0.8 - 0.5) / (1 - 0.5)) && a.kappa === 0.6 && a.interpretation === "moderate", "kappa=" + a.kappa);
    check("DL-04 per-label agreement: urgent agreed on 4, routine on 4, one solo each way per label",
      byLabel.urgent.agreedOn === 4 && byLabel.routine.agreedOn === 4 &&
      byLabel.urgent.aOnly === 1 && byLabel.urgent.bOnly === 1 && byLabel.routine.aOnly === 1 && byLabel.routine.bOnly === 1,
      "urgent=" + byLabel.urgent.agreedOn + ", routine=" + byLabel.routine.agreedOn);
    check("DL-05 disagreement queue is exactly DL-05 (urgent vs routine) and DL-06 (routine vs urgent)",
      a.disagreements.map((d) => d.itemRef).join(",") === "DL-05,DL-06" &&
      a.disagreements[0].labelA === "urgent" && a.disagreements[0].labelB === "routine" &&
      a.disagreements[1].labelA === "routine" && a.disagreements[1].labelB === "urgent",
      a.disagreements.map((d) => d.itemRef).join(","));
    const queue = (await req("GET", "/api/v1/schemas/" + triage.id + "/disagreements", T)).json.data;
    check("disagreements endpoint returns the same open queue of 2 with item text",
      queue.disagreements.length === 2 && queue.disagreements[0].itemRef === "DL-05" &&
      queue.disagreements[0].text.includes("Mild sensitivity"), "open=" + queue.disagreements.length);
    check("DL-06 triage progress: Zara 10/10 = 100% and Callum 10/10 = 100%",
      ag.progress[0].done === 10 && ag.progress[0].total === 10 && ag.progress[0].percent === 100 &&
      ag.progress[1].done === 10 && ag.progress[1].percent === 100,
      ag.progress.map((p) => p.name + " " + p.percent + "%").join(", "));

    // ---- Second fixture (Ticket Intent) ----
    const ag2 = (await req("GET", "/api/v1/schemas/" + intent.id + "/agreement", T)).json.data;
    const a2 = ag2.agreement;
    const by2 = Object.fromEntries(a2.perLabel.map((r) => [r.label, r]));
    check("DL-07 intent doubly-labelled set is 4 items with po = 3/4 = 0.75",
      a2.items === 4 && a2.agreed === 3 && a2.po === 0.75, "po=" + a2.po + ", items=" + a2.items);
    check("DL-08 intent pe = 0.125 + 0.125 + 0.0625 = 0.3125 from the two annotators' marginals",
      by2.billing.peContribution === 0.125 && by2.booking.peContribution === 0.125 &&
      by2.clinical.peContribution === 0.0625 && a2.pe === 0.3125 &&
      by2.billing.marginalA === 0.5 && by2.billing.marginalB === 0.25, "pe=" + a2.pe);
    check("DL-09 intent kappa = (0.75 - 0.3125) / (1 - 0.3125) = 0.6364, band substantial",
      a2.kappa === r4((0.75 - 0.3125) / (1 - 0.3125)) && a2.kappa === 0.6364 && a2.interpretation === "substantial",
      "kappa=" + a2.kappa);
    check("DL-10 intent progress: Zara 6/8 = 75% and Callum 4/8 = 50%",
      ag2.progress[0].done === 6 && ag2.progress[0].total === 8 && ag2.progress[0].percent === 75 &&
      ag2.progress[1].done === 4 && ag2.progress[1].percent === 50,
      ag2.progress.map((p) => p.percent + "%").join(", "));
    check("DL-11 overall progress: Zara 16/18 = 88.8889% and Callum 14/18 = 77.7778%",
      annotators[0].progress.done === 16 && annotators[0].progress.total === 18 && annotators[0].progress.percent === r4(100 * 16 / 18) &&
      annotators[1].progress.done === 14 && annotators[1].progress.percent === r4(100 * 14 / 18),
      annotators[0].progress.percent + "%, " + annotators[1].progress.percent + "%");

    // ---- Export summaries ----
    const exp1 = (await req("GET", "/api/v1/schemas/" + triage.id + "/export-summary", T)).json.data;
    const dist1 = Object.fromEntries(exp1.distribution.map((d) => [d.label, d]));
    check("DL-12 triage export: urgent 4 (40%), routine 4 (40%), unresolved 2 (20%)",
      dist1.urgent.count === 4 && dist1.urgent.percent === 40 && dist1.routine.count === 4 && dist1.routine.percent === 40 &&
      exp1.unresolved === 2 && exp1.unresolvedPercent === 20 && exp1.totalItems === 10,
      JSON.stringify(exp1.distribution) + " unresolved=" + exp1.unresolved);
    const exp2 = (await req("GET", "/api/v1/schemas/" + intent.id + "/export-summary", T)).json.data;
    const dist2 = Object.fromEntries(exp2.distribution.map((d) => [d.label, d]));
    check("DL-13 intent export: billing 2 (25%), booking 1 (12.5%), clinical 2 (25%), unresolved 3 (37.5%)",
      dist2.billing.count === 2 && dist2.billing.percent === 25 && dist2.booking.count === 1 && dist2.booking.percent === 12.5 &&
      dist2.clinical.count === 2 && dist2.clinical.percent === 25 && exp2.unresolved === 3 && exp2.unresolvedPercent === 37.5,
      JSON.stringify(exp2.distribution));
    check("DL-14 final-label sources: DL-05 disagreement, TI-05 single-annotation billing, TI-07 unresolved",
      exp1.finals.find((f) => f.itemRef === "DL-05").source === "disagreement" &&
      exp1.finals.find((f) => f.itemRef === "DL-05").finalLabel === null &&
      exp2.finals.find((f) => f.itemRef === "TI-05").source === "single-annotation" &&
      exp2.finals.find((f) => f.itemRef === "TI-05").finalLabel === "billing" &&
      exp2.finals.find((f) => f.itemRef === "TI-07").source === "unresolved",
      "sources checked");
    const gen = await req("POST", "/api/v1/exports", T, { schemaId: triage.id });
    check("generated export record carries kappa 0.6 and the triage distribution",
      gen.status === 201 && gen.json.data.export.kappa === 0.6 && gen.json.data.export.summary.includes("urgent 4 (40%)"),
      "HTTP " + gen.status + ", kappa=" + (gen.json.data.export || {}).kappa);
    const exportsList = (await req("GET", "/api/v1/exports", T)).json.data.exports;
    check("exports list holds the seeded export plus the generated one", exportsList.length === 2, "count=" + exportsList.length);

    // ---- Adjudication resolves a disagreement ----
    const dl05 = triageDetail.items.find((i) => i.ref === "DL-05");
    const adj = await req("POST", "/api/v1/adjudications", T, { itemId: dl05.id, finalLabel: "urgent", adjudicator: "Priya Shah", note: "Sensitivity persisting a week needs a dentist review." });
    check("adjudicating DL-05 as urgent returns 201", adj.status === 201 && adj.json.data.adjudication.finalLabel === "urgent", "HTTP " + adj.status);
    const distAfter = Object.fromEntries(adj.json.data.exportSummary.distribution.map((d) => [d.label, d]));
    check("DL-15 after adjudication: urgent 5 (50%), routine 4 (40%), unresolved 1 (10%), queue down to 1",
      distAfter.urgent.count === 5 && distAfter.urgent.percent === 50 && distAfter.routine.count === 4 &&
      adj.json.data.exportSummary.unresolved === 1 && adj.json.data.exportSummary.unresolvedPercent === 10 &&
      adj.json.data.openDisagreements === 1,
      "urgent=" + distAfter.urgent.count + ", unresolved=" + adj.json.data.exportSummary.unresolved);
    const queueAfter = (await req("GET", "/api/v1/schemas/" + triage.id + "/disagreements", T)).json.data;
    check("review queue now holds only DL-06",
      queueAfter.disagreements.length === 1 && queueAfter.disagreements[0].itemRef === "DL-06",
      queueAfter.disagreements.map((d) => d.itemRef).join(","));
    const itemAfter = (await req("GET", "/api/v1/items/" + dl05.id, T)).json.data;
    check("item detail for DL-05 shows both annotations and Priya Shah's adjudication",
      itemAfter.annotations.length === 2 && itemAfter.adjudication !== null &&
      itemAfter.adjudication.finalLabel === "urgent" && itemAfter.adjudication.adjudicator === "Priya Shah",
      "annotations=" + itemAfter.annotations.length);
    check("adjudicating with a label outside the schema is a 400",
      (await req("POST", "/api/v1/adjudications", T, { itemId: dl05.id, finalLabel: "whenever" })).status === 400, "HTTP 400");

    // ---- Accounts, scoping, roles ----
    const staffLogin = await req("POST", "/api/v1/auth/login", null, { email: "team@labelworks.co.uk", password: "Team2026!" });
    const ST = staffLogin.json.data.token;
    check("staff cannot update the project profile (owner only)",
      (await req("PUT", "/api/v1/project", ST, { name: "Nope" })).status === 403, "HTTP 403");
    const reg = await req("POST", "/api/v1/auth/register", null,
      { fullName: "Fixture Owner", email: "fixtures@example.co.uk", password: "Owner2026!", projectName: "Fixture Label Lab" });
    const TA = reg.json.data.token;
    check("register creates an owner with an empty workspace", reg.status === 201 && !!TA, "HTTP " + reg.status);
    check("duplicate email rejected", (await req("POST", "/api/v1/auth/register", null,
      { fullName: "Copy", email: "fixtures@example.co.uk", password: "Owner2026!", projectName: "Copy Lab" })).status === 409, "HTTP 409 EMAIL_TAKEN");
    check("another project cannot read the seeded schema", (await req("GET", "/api/v1/schemas/" + triage.id, TA)).status === 404, "HTTP 404");
    check("another project cannot read the seeded item", (await req("GET", "/api/v1/items/" + dl05.id, TA)).status === 404, "HTTP 404");
    check("another project cannot read the seeded agreement", (await req("GET", "/api/v1/schemas/" + triage.id + "/agreement", TA)).status === 404, "HTTP 404");
    check("unknown schema is 404", (await req("GET", "/api/v1/schemas/99999", T)).status === 404, "HTTP 404");
    check("unknown item is 404", (await req("GET", "/api/v1/items/99999", T)).status === 404, "HTTP 404");

    // ---- New workspace: hand-built agreement fixture over the API ----
    const annA = await req("POST", "/api/v1/annotators", TA, { name: "Nadia Hussain", email: "nadia@example.co.uk" });
    const annB = await req("POST", "/api/v1/annotators", TA, { name: "Felix Grant", email: "felix@example.co.uk" });
    check("two annotators are created in the new workspace with 201",
      annA.status === 201 && annB.status === 201, "HTTP " + annA.status + "/" + annB.status);
    const fx = await req("POST", "/api/v1/schemas", TA, { name: "Fresh Triage Fixture", labels: ["urgent", "routine"],
      task: "Hand-built agreement fixture",
      items: [
        { ref: "FX-01", text: "Tooth pain keeping me awake" },
        { ref: "FX-02", text: "Gum soreness after flossing" },
        { ref: "FX-03", text: "Six-month check-up reminder" },
        { ref: "FX-04", text: "Whitening quote request" },
      ] });
    check("new schema with inline items is created with 201 and 4 items",
      fx.status === 201 && fx.json.data.schema.itemCount === 4, "HTTP " + fx.status);
    const fxId = fx.json.data.schema.id;
    const fxItems = (await req("GET", "/api/v1/schemas/" + fxId, TA)).json.data.items;
    const idA = annA.json.data.annotator.id, idB = annB.json.data.annotator.id;
    const asg = {};
    for (const it of fxItems) {
      asg["A:" + it.ref] = (await req("POST", "/api/v1/assignments", TA, { itemId: it.id, annotatorId: idA })).json.data.assignment.id;
      asg["B:" + it.ref] = (await req("POST", "/api/v1/assignments", TA, { itemId: it.id, annotatorId: idB })).json.data.assignment.id;
    }
    check("eight assignments are created (4 items x 2 annotators)", Object.keys(asg).length === 8, "count=" + Object.keys(asg).length);
    const labelsA = { "FX-01": "urgent", "FX-02": "urgent", "FX-03": "routine", "FX-04": "routine" };
    const labelsB = { "FX-01": "urgent", "FX-02": "routine", "FX-03": "routine", "FX-04": "routine" };
    let firstProgress = null;
    for (const ref of Object.keys(labelsA)) {
      const r = await req("POST", "/api/v1/annotations", TA, { assignmentId: asg["A:" + ref], label: labelsA[ref] });
      if (!firstProgress) firstProgress = r.json.data.progress;
    }
    check("first annotation reports progress 1/4 = 25% on the schema",
      firstProgress.done === 1 && firstProgress.total === 4 && firstProgress.percent === 25,
      "progress=" + JSON.stringify(firstProgress));
    for (const ref of Object.keys(labelsB))
      await req("POST", "/api/v1/annotations", TA, { assignmentId: asg["B:" + ref], label: labelsB[ref] });
    const fxAg = (await req("GET", "/api/v1/schemas/" + fxId + "/agreement?annotatorA=" + idA + "&annotatorB=" + idB, TA)).json.data.agreement;
    check("DL-16 fresh fixture: po = 3/4 = 0.75 and pe = 0.5x0.25 + 0.5x0.75 = 0.5",
      fxAg.po === 0.75 && fxAg.pe === 0.5 && fxAg.agreed === 3, "po=" + fxAg.po + ", pe=" + fxAg.pe);
    check("DL-17 fresh fixture kappa = (0.75 - 0.5) / (1 - 0.5) = 0.5 exactly",
      fxAg.kappa === 0.5 && fxAg.interpretation === "moderate", "kappa=" + fxAg.kappa);
    check("an annotation with a label outside the schema is a 400",
      (await req("POST", "/api/v1/annotations", TA, { assignmentId: asg["A:FX-01"], label: "other" })).status === 400, "HTTP 400 BAD_LABEL");
    check("a schema with fewer than two labels is a 400",
      (await req("POST", "/api/v1/schemas", TA, { name: "One Label", labels: ["only"] })).status === 400, "HTTP 400");
    const addedItem = await req("POST", "/api/v1/schemas/" + fxId + "/items", TA, { text: "New patient asking about registration" });
    check("adding an item to a schema returns 201", addedItem.status === 201 && addedItem.json.data.item.text.includes("registration"), "HTTP " + addedItem.status);

    // ---- Project, notifications, session ----
    const proj = (await req("GET", "/api/v1/project", T)).json.data.project;
    check("project profile is the Northgate Dental workspace in the Northern Quarter",
      proj.team === "LabelWorks Manchester" && proj.location === "Northern Quarter, Manchester", proj.team + " · " + proj.location);
    const upd = await req("PUT", "/api/v1/project", T, { sector: "Annotation & evaluation studio" });
    check("owner can update the project profile", upd.status === 200 && upd.json.data.project.sector === "Annotation & evaluation studio", "HTTP " + upd.status);
    const notes = (await req("GET", "/api/v1/notifications", T)).json.data.notifications;
    check("seeded notifications are present", notes.length >= 2, "count=" + notes.length);
    check("marking notifications read succeeds",
      (await req("PATCH", "/api/v1/notifications/read", T)).json.data.markedRead === true, "markedRead=true");
    const me = (await req("GET", "/api/v1/auth/me", T)).json.data.user;
    check("signed-in profile is Imogen Hart", me.fullName === "Imogen Hart" && me.role === "owner", me.fullName);
    check("logout succeeds", (await req("POST", "/api/v1/auth/logout", T)).json.data.signedOut === true, "signedOut=true");
  } catch (err) {
    failed++; console.log("FAIL  unexpected error - " + (err && err.stack || err));
  } finally {
    server.kill();
    await new Promise((r) => setTimeout(r, 500));
    try {
      fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    } catch (_) {
      // Best-effort cleanup on Windows where background process locks may release with a delay
    }
  }
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})();
