"use strict";
/* DataLabel console — hash-routed SPA, every view backed by the real API. */
const app = document.getElementById("app");
let token = localStorage.getItem("datalabel_token") || "";
let me = null;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
async function api(method, path, body) {
  const res = await fetch(path, { method, headers: { "Content-Type": "application/json",
    ...(token ? { Authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json.error && json.error.message) || ("HTTP " + res.status));
  return json.data;
}
const num = (n) => (Math.round(Number(n) * 10000) / 10000).toString();
function statsGrid(items) {
  return '<div class="grid">' + items.map(([v, l]) =>
    '<div class="stat"><div class="v">' + esc(v) + '</div><div class="l">' + esc(l) + "</div></div>").join("") + "</div>";
}
function bar(pct) {
  return '<div class="bar"><i style="width:' + Math.min(100, Number(pct)) + '%"></i></div>';
}
function kappaPill(k) {
  const kind = k >= 0.61 ? "good" : k >= 0.41 ? "warn" : "bad";
  return '<span class="pill ' + kind + '">kappa ' + num(k) + "</span>";
}

async function viewDashboard() {
  const d = await api("GET", "/api/v1/dashboard");
  const h = d.headlineAgreement;
  app.innerHTML = "<h1>" + esc(d.project.team || d.project.name) + "</h1>" +
    '<div class="card hero"><div class="big">' + (h ? num(h.kappa) : "—") + '</div>' +
    "<div>Headline Cohen's kappa" + (h ? " — " + esc(h.schema.name) + " · po " + num(h.po) + " · pe " + num(h.pe) + " · " + esc(h.interpretation || "") : "") + "</div>" +
    '<p class="mono" style="font-size:12.5px;color:#e9c8de">' + esc(d.project.name) + " · " + esc(d.project.location) + "</p></div>" +
    statsGrid([[d.stats.schemas, "Label schemas"], [d.stats.items, "Items"], [d.stats.annotations, "Annotations"],
      [d.stats.openDisagreements, "Open disagreements"], [d.stats.adjudications, "Adjudications"]]) +
    "<h2>Agreement by schema</h2><div class='card'><table><tr><th>Schema</th><th>po</th><th>pe</th><th>Kappa</th><th>Band</th><th>Open disagreements</th></tr>" +
    d.schemaAgreements.map((s) => "<tr><td>" + esc(s.schema.name) + "</td><td>" + num(s.po) + "</td><td>" + num(s.pe) +
      "</td><td>" + kappaPill(s.kappa) + "</td><td>" + esc(s.interpretation || "—") + "</td><td>" + s.openDisagreements + "</td></tr>").join("") + "</table></div>" +
    "<h2>Recent exports</h2><div class='card'>" + (d.recentExports.length
      ? d.recentExports.map((e) => "<p><span class='pill'>" + esc(e.reference) + "</span> " + esc(e.title) + "</p>").join("")
      : "No exports yet.") + "</div>";
}
async function viewSchemas() {
  const d = await api("GET", "/api/v1/schemas");
  app.innerHTML = "<h1>Label Schemas</h1><p class='muted'>A schema fixes the label set for a labelling project. Annotators can only choose labels from the schema, so agreement is always measured over the same vocabulary.</p>" +
    "<div class='card'><table><tr><th>Schema</th><th>Task</th><th>Labels</th><th>Items</th><th>Annotations</th></tr>" +
    d.schemas.map((s) => '<tr><td><a href="#/schema/' + s.id + '">' + esc(s.name) + "</a></td><td>" + esc(s.task) + "</td><td>" +
      s.labels.map((l) => '<span class="pill">' + esc(l) + "</span>").join(" ") + "</td><td>" + s.itemCount + "</td><td>" + s.annotationCount + "</td></tr>").join("") + "</table></div>" +
    '<div class="card"><h3>New label schema</h3><label>Name</label><input id="ns-name">' +
    '<label>Labels (comma separated)</label><input id="ns-labels" placeholder="urgent, routine">' +
    '<label>Task</label><input id="ns-task"><button class="accent" id="ns-add">Create schema</button></div>';
  document.getElementById("ns-add").onclick = async () => {
    await api("POST", "/api/v1/schemas", { name: document.getElementById("ns-name").value,
      labels: document.getElementById("ns-labels").value.split(",").map((x) => x.trim()).filter(Boolean),
      task: document.getElementById("ns-task").value });
    viewSchemas();
  };
}
async function viewSchema(id) {
  const d = await api("GET", "/api/v1/schemas/" + id);
  const sum = await api("GET", "/api/v1/schemas/" + id + "/export-summary");
  app.innerHTML = "<h1>" + esc(d.schema.name) + "</h1><p class='muted'>" + esc(d.schema.task) + "</p>" +
    "<p>" + d.schema.labels.map((l) => '<span class="pill">' + esc(l) + "</span>").join(" ") + "</p>" +
    "<div class='card'><table><tr><th>Ref</th><th>Item text</th><th>Final label</th><th>Source</th></tr>" +
    sum.finals.map((f, i) => "<tr><td class='mono'>" + esc(f.itemRef) + "</td><td>" + esc(d.items[i] ? d.items[i].text : "") +
      "</td><td>" + esc(f.finalLabel || "—") + "</td><td>" + esc(f.source) + "</td></tr>").join("") + "</table></div>" +
    '<div class="card"><h3>Add an item</h3><label>Text</label><input id="ni-text">' +
    '<button class="accent" id="ni-add">Add item</button></div>';
  document.getElementById("ni-add").onclick = async () => {
    await api("POST", "/api/v1/schemas/" + id + "/items", { text: document.getElementById("ni-text").value });
    viewSchema(id);
  };
}
async function viewAnnotators() {
  const d = await api("GET", "/api/v1/annotators");
  app.innerHTML = "<h1>Annotators</h1><p class='muted'>Progress counts completed assignments against everything assigned, across all schemas in this workspace.</p>" +
    "<div class='card'><table><tr><th>Annotator</th><th>Role</th><th>Done</th><th>Total</th><th>Progress</th><th></th></tr>" +
    d.annotators.map((a) => "<tr><td>" + esc(a.name) + "</td><td>" + esc(a.role) + "</td><td>" + a.progress.done +
      "</td><td>" + a.progress.total + "</td><td>" + num(a.progress.percent) + "%</td><td>" + bar(a.progress.percent) + "</td></tr>").join("") + "</table></div>" +
    '<div class="card"><h3>New annotator</h3><label>Name</label><input id="na-name"><label>Email</label><input id="na-email">' +
    '<label>Role</label><select id="na-role"><option>annotator</option><option>adjudicator</option></select>' +
    '<button class="accent" id="na-add">Add annotator</button></div>';
  document.getElementById("na-add").onclick = async () => {
    await api("POST", "/api/v1/annotators", { name: document.getElementById("na-name").value,
      email: document.getElementById("na-email").value, role: document.getElementById("na-role").value });
    viewAnnotators();
  };
}
async function viewQueue() {
  const items = (await api("GET", "/api/v1/items")).items;
  const rows = [];
  for (const it of items.slice(0, 40)) {
    const det = await api("GET", "/api/v1/items/" + it.id);
    for (const a of det.assignments) rows.push([it, a, det.annotations.find((x) => x.annotatorId === a.annotatorId)]);
  }
  app.innerHTML = "<h1>Annotation Queue</h1><p class='muted'>Every assignment in the workspace: who owes which item, and the label they gave when they finished it.</p>" +
    "<div class='card'><table><tr><th>Item</th><th>Text</th><th>Annotator</th><th>Status</th><th>Label</th></tr>" +
    rows.map(([it, a, ann]) => "<tr><td class='mono'>" + esc(it.ref) + "</td><td>" + esc(it.text) + "</td><td>" + esc(a.annotatorName) +
      "</td><td>" + (a.status === "completed" ? '<span class="right">completed</span>' : "pending") + "</td><td>" + esc(ann ? ann.label : "—") + "</td></tr>").join("") + "</table></div>";
}
async function viewAnnotate() {
  const items = (await api("GET", "/api/v1/items")).items;
  const pending = [];
  for (const it of items) {
    const det = await api("GET", "/api/v1/items/" + it.id);
    for (const a of det.assignments) if (a.status === "pending") pending.push({ item: it, assignment: a, schemaId: it.schemaId });
  }
  const schemas = (await api("GET", "/api/v1/schemas")).schemas;
  const labelsOf = Object.fromEntries(schemas.map((s) => [s.id, s.labels]));
  app.innerHTML = "<h1>Annotate</h1><div class='card'><p class='muted'>Pick a pending assignment, choose the label from the item's schema, and submit. The annotation is stored against the assignment and the annotator's progress updates immediately.</p>" +
    '<label>Pending assignment</label><select id="an-asg">' +
    pending.map((p, i) => '<option value="' + i + '">' + esc(p.item.ref) + " — " + esc(p.item.text) + " (" + esc(p.assignment.annotatorName) + ")</option>").join("") + "</select>" +
    '<label>Label</label><select id="an-label"></select><label>Note (optional)</label><input id="an-note">' +
    '<button class="accent" id="an-go">Submit annotation</button><div id="an-out" style="margin-top:12px"></div></div>';
  const labelSel = document.getElementById("an-label");
  const fill = () => {
    const p = pending[Number(document.getElementById("an-asg").value || 0)];
    labelSel.innerHTML = p ? (labelsOf[p.schemaId] || []).map((l) => "<option>" + esc(l) + "</option>").join("") : "";
  };
  document.getElementById("an-asg").onchange = fill; fill();
  document.getElementById("an-go").onclick = async () => {
    try {
      const p = pending[Number(document.getElementById("an-asg").value || 0)];
      const d = await api("POST", "/api/v1/annotations", { assignmentId: p.assignment.id,
        label: labelSel.value, note: document.getElementById("an-note").value });
      document.getElementById("an-out").innerHTML = "Saved — " + esc(p.assignment.annotatorName) + " is now at " +
        d.progress.done + "/" + d.progress.total + " (" + num(d.progress.percent) + "%) on this schema.";
    } catch (e) { document.getElementById("an-out").innerHTML = '<div class="err">' + esc(e.message) + "</div>"; }
  };
}
async function viewAgreement() {
  const schemas = (await api("GET", "/api/v1/schemas")).schemas;
  app.innerHTML = "<h1>Agreement</h1><div class='card'><label>Schema</label><select id='ag-schema'>" +
    schemas.map((s) => '<option value="' + s.id + '">' + esc(s.name) + "</option>").join("") + "</select>" +
    '<button class="accent" id="ag-go">Measure agreement</button><div id="ag-out" style="margin-top:14px"></div></div>';
  const run = async () => {
    const id = document.getElementById("ag-schema").value;
    const d = await api("GET", "/api/v1/schemas/" + id + "/agreement");
    const a = d.agreement;
    document.getElementById("ag-out").innerHTML =
      statsGrid([[num(a.po), "Observed agreement po (" + a.agreed + "/" + a.items + ")"], [num(a.pe), "Expected by chance pe"],
        [num(a.kappa), "Cohen's kappa"], [esc(a.interpretation || "—"), "Interpretation band"]]) +
      "<p class='muted mono' style='font-size:12.5px'>" + esc(a.formula) + " · " + esc(d.annotatorA.name) + " vs " + esc(d.annotatorB.name) + "</p>" +
      "<table><tr><th>Label</th><th>Count A</th><th>Count B</th><th>Marginal A</th><th>Marginal B</th><th>pe contribution</th><th>Agreed on</th></tr>" +
      a.perLabel.map((r) => "<tr><td>" + esc(r.label) + "</td><td>" + r.countA + "</td><td>" + r.countB + "</td><td>" + num(r.marginalA) +
        "</td><td>" + num(r.marginalB) + "</td><td>" + num(r.peContribution) + "</td><td>" + r.agreedOn + "</td></tr>").join("") + "</table>" +
      "<h3>Progress on this schema</h3>" + d.progress.map((p) => "<p>" + esc(p.name) + ": " + p.done + "/" + p.total + " (" + num(p.percent) + "%)</p>").join("");
  };
  document.getElementById("ag-go").onclick = run;
  if (schemas.length) run();
}
async function viewDisagreements() {
  const schemas = (await api("GET", "/api/v1/schemas")).schemas;
  let html = "<h1>Disagreement Review</h1><p class='muted'>Items where the two annotators chose different labels and no adjudicator has settled them yet. An adjudicator picks the final label; the item then leaves the queue and counts in the export under that label.</p>";
  const all = [];
  for (const s of schemas) {
    const d = await api("GET", "/api/v1/schemas/" + s.id + "/disagreements");
    for (const x of d.disagreements) all.push({ schema: s, ...x });
  }
  html += "<div class='card'>" + (all.length
    ? "<table><tr><th>Item</th><th>Text</th><th>Annotator A</th><th>Annotator B</th></tr>" +
      all.map((x) => "<tr><td class='mono'>" + esc(x.itemRef) + "</td><td>" + esc(x.text) + "</td><td>" + esc(x.labelA) + "</td><td>" + esc(x.labelB) + "</td></tr>").join("") + "</table>"
    : "Queue clear — no open disagreements.") + "</div>" +
    '<div class="card"><h3>Adjudicate an item</h3><label>Item</label><select id="ad-item">' +
    all.map((x) => '<option value="' + x.itemId + '">' + esc(x.itemRef) + " — " + esc(x.text) + "</option>").join("") + "</select>" +
    '<label>Final label</label><input id="ad-label" placeholder="e.g. urgent"><label>Adjudicator</label><input id="ad-who" value="Priya Shah">' +
    '<button class="accent" id="ad-go">Set final label</button><div id="ad-out" style="margin-top:12px"></div></div>';
  app.innerHTML = html;
  document.getElementById("ad-go").onclick = async () => {
    try {
      const d = await api("POST", "/api/v1/adjudications", { itemId: Number(document.getElementById("ad-item").value),
        finalLabel: document.getElementById("ad-label").value, adjudicator: document.getElementById("ad-who").value });
      document.getElementById("ad-out").innerHTML = "Final label set. Open disagreements on this schema: " + d.openDisagreements + ".";
    } catch (e) { document.getElementById("ad-out").innerHTML = '<div class="err">' + esc(e.message) + "</div>"; }
  };
}
async function viewExports() {
  const d = await api("GET", "/api/v1/exports");
  const schemas = (await api("GET", "/api/v1/schemas")).schemas;
  let first = "";
  if (schemas.length) {
    const s = await api("GET", "/api/v1/schemas/" + schemas[0].id + "/export-summary");
    first = "<h2>Live summary — " + esc(s.schema.name) + "</h2><div class='card'><table><tr><th>Final label</th><th>Items</th><th>Share</th></tr>" +
      s.distribution.map((x) => "<tr><td>" + esc(x.label) + "</td><td>" + x.count + "</td><td>" + num(x.percent) + "%</td></tr>").join("") +
      "<tr><td>unresolved</td><td>" + s.unresolved + "</td><td>" + num(s.unresolvedPercent) + "%</td></tr></table></div>";
  }
  app.innerHTML = "<h1>Exports</h1>" + d.exports.map((e) => '<div class="card"><span class="pill">' + esc(e.reference) + "</span> " +
    (e.kappa !== null && e.kappa !== undefined ? kappaPill(e.kappa) : "") + "<h3>" + esc(e.title) + "</h3><p class='muted'>" + esc(e.summary) + "</p></div>").join("") +
    first +
    '<div class="card"><h3>Generate an export summary</h3><label>Schema</label><select id="ex-schema">' +
    schemas.map((s) => '<option value="' + s.id + '">' + esc(s.name) + "</option>").join("") +
    '</select><button class="accent" id="ex-go">Generate export</button></div>';
  document.getElementById("ex-go").onclick = async () => {
    await api("POST", "/api/v1/exports", { schemaId: Number(document.getElementById("ex-schema").value) });
    viewExports();
  };
}
async function viewHelp() {
  const p = (await api("GET", "/api/v1/project")).project;
  const notes = (await api("GET", "/api/v1/notifications")).notifications;
  app.innerHTML = "<h1>Settings &amp; Help</h1><div class='card'><h3>Project</h3>" +
    '<label>Workspace name</label><input id="pj-name" value="' + esc(p.name) + '">' +
    '<label>Team</label><input id="pj-team" value="' + esc(p.team) + '">' +
    '<label>Location</label><input id="pj-loc" value="' + esc(p.location) + '">' +
    '<button class="accent" id="pj-save">Save project</button></div>' +
    "<div class='card'><h3>How agreement works</h3><p class='muted'>For two annotators over the items both have labelled: po is the share of items where they chose the same label. pe is the agreement expected by chance from their own label marginals — for each label, marginalA × marginalB, summed over labels. Cohen's kappa = (po − pe) ÷ (1 − pe). Bands: 0.41–0.60 moderate, 0.61–0.80 substantial, 0.81–1.00 almost perfect. Every API response carries the marginals and per-label counts behind the headline figure.</p>" +
    "<p class='muted'>DataLabel ships with seeded local datasets for a fictional Manchester annotation team labelling a fictional dental group's messages, so every workflow runs offline. In a production engagement the same interfaces connect to the team's annotation platform and hosted model APIs (OpenAI, Anthropic, Google, Azure OpenAI) for pre-labelling — see the PRD backlog.</p></div>" +
    "<div class='card'><h3>Notifications</h3>" + notes.map((n) => "<p><strong>" + esc(n.title) + "</strong><br><span class='muted'>" + esc(n.body) + "</span></p>").join("") +
    '<button id="nt-read">Mark all read</button></div>';
  document.getElementById("pj-save").onclick = async () => {
    await api("PUT", "/api/v1/project", { name: document.getElementById("pj-name").value,
      team: document.getElementById("pj-team").value, location: document.getElementById("pj-loc").value });
    alert("Project saved");
  };
  document.getElementById("nt-read").onclick = async () => { await api("PATCH", "/api/v1/notifications/read"); viewHelp(); };
}
function viewLogin() {
  app.innerHTML = "<h1>Sign in to DataLabel</h1><div class='card' style='max-width:520px'>" +
    '<label>Email</label><input id="li-email" value="owner@labelworks.co.uk">' +
    '<label>Password</label><input id="li-pass" type="password" value="Owner2026!">' +
    '<div id="li-err"></div><button class="accent" id="li-go">Sign in</button>' +
    "<p class='muted'>Seeded showcase account for the LabelWorks Manchester workspace. Register a new account below for an empty workspace.</p>" +
    '<label>Full name</label><input id="rg-name"><label>Workspace name</label><input id="rg-proj">' +
    '<label>Email</label><input id="rg-email"><label>Password (8+ characters)</label><input id="rg-pass" type="password">' +
    '<button id="rg-go">Register</button></div>';
  document.getElementById("li-go").onclick = async () => {
    try {
      const d = await api("POST", "/api/v1/auth/login", { email: document.getElementById("li-email").value, password: document.getElementById("li-pass").value });
      token = d.token; localStorage.setItem("datalabel_token", token); route();
    } catch (e) { document.getElementById("li-err").innerHTML = '<div class="err">' + esc(e.message) + "</div>"; }
  };
  document.getElementById("rg-go").onclick = async () => {
    try {
      const d = await api("POST", "/api/v1/auth/register", { fullName: document.getElementById("rg-name").value,
        projectName: document.getElementById("rg-proj").value, email: document.getElementById("rg-email").value,
        password: document.getElementById("rg-pass").value });
      token = d.token; localStorage.setItem("datalabel_token", token); route();
    } catch (e) { document.getElementById("li-err").innerHTML = '<div class="err">' + esc(e.message) + "</div>"; }
  };
}
async function route() {
  const hash = location.hash || "#/dashboard";
  const parts = hash.replace(/^#\//, "").split("/");
  const who = document.getElementById("who");
  if (!token) { who.textContent = ""; return viewLogin(); }
  try {
    if (!me) me = (await api("GET", "/api/v1/auth/me")).user;
    who.textContent = me.fullName + " · ";
    const view = parts[0] || "dashboard";
    if (view === "dashboard") return await viewDashboard();
    if (view === "schemas") return await viewSchemas();
    if (view === "schema") return await viewSchema(parts[1]);
    if (view === "annotators") return await viewAnnotators();
    if (view === "queue") return await viewQueue();
    if (view === "annotate") return await viewAnnotate();
    if (view === "agreement") return await viewAgreement();
    if (view === "disagreements") return await viewDisagreements();
    if (view === "exports") return await viewExports();
    if (view === "help") return await viewHelp();
    return await viewDashboard();
  } catch (e) {
    if (/Sign in|not recognised/i.test(e.message)) { token = ""; me = null; localStorage.removeItem("datalabel_token"); return viewLogin(); }
    app.innerHTML = '<div class="err">' + esc(e.message) + "</div>";
  }
}
document.getElementById("signout").onclick = async (ev) => {
  ev.preventDefault();
  try { await api("POST", "/api/v1/auth/logout"); } catch { /* already out */ }
  token = ""; me = null; localStorage.removeItem("datalabel_token"); route();
};
window.addEventListener("hashchange", route);
route();
