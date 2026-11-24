# DataLabel — Technical Requirements Document

**Product:** DataLabel — Annotation & Agreement Studio
**Service line:** AI Development (Series 10, product 7 of 10)
**Built by:** SPManchester — https://spmanchester.com/

## 1. Architecture (zero → high level)

- **Zero level:** a single Node.js process (`backend/src/server.js`,
  `node:http`) serving a JSON API under `/api/v1/…`, a health check at
  `GET /health`, and the static web console from `web/` at `/`. Storage
  is one SQLite file via the built-in `node:sqlite` module; passwords
  and tokens use `node:crypto`. No external dependencies, no network
  calls, no API keys.
- **Mid level:** an explicit router (`backend/src/app.js`) dispatches to
  route modules (`routes/auth.js`, `routes/labels.js`, `routes/misc.js`)
  declared as `[method, pattern, ...handlers]` with `:param` patterns.
  Token-auth middleware resolves the caller and their labelling project;
  every domain query is scoped by `project_id`.
- **High level:** all agreement mathematics lives in one self-contained
  module, `backend/src/ai/engine.js`, as pure functions over plain data.
  `backend/src/seed.js` holds the shared read models (agreement for a
  schema/pair, export summary for a schema) used by the routes, the
  dashboard and the seed itself, so the seeded workspace, the API and the
  tests all exercise the same code path.

## 2. Module map

| Module | Responsibility |
|---|---|
| `backend/src/server.js` | HTTP server bootstrap (PORT/HOST env, signal handling) |
| `backend/src/app.js` | Router, body parsing, `/health`, static serving of `web/` |
| `backend/src/db.js` | SQLite open/migrate; the 11-table schema (mirrors `database/schema.sql`) |
| `backend/src/ai/engine.js` | Agreement (po/pe/κ), kappa bands, annotator progress, final-label export summaries |
| `backend/src/seed-data.js` | Seeded showcase data: team, schemas, items, fixed per-item annotator labels |
| `backend/src/seed.js` | Idempotent seeding; `createProject`, schema/item/annotator shapes, assignment/annotation writers, agreement & export read models |
| `backend/src/routes/auth.js` | Register / login / logout / profile |
| `backend/src/routes/labels.js` | Schemas, items, annotators, assignments, annotations, agreement, disagreements, adjudications, export summary |
| `backend/src/routes/misc.js` | Dashboard, project profile, export records, notifications |
| `backend/src/middleware/` | Token auth (`requireAuth` / `requireOwner`), error mapping, required-field validation |
| `backend/src/utils/` | JSON responses + static files; token generation, scrypt password hashing |
| `web/` | Hash-routed SPA (10 views), every view calling the real API |
| `tests/run-tests.js` | Live HTTP test harness on a fresh temporary database |
| `preview/` | PIL screenshot renderer + its data config |

## 3. Algorithms — exactly as implemented

### 3.1 Inter-annotator agreement (`computeAgreement`)

Input: `pairs` — the items **both** annotators have labelled, as
`{ itemRef, labelA, labelB }` — and the schema's ordered `labels`.

- `N` = number of doubly-labelled items; `agreed` = pairs with
  `labelA === labelB`.
- **Observed agreement:** `po = agreed / N` (0 when N = 0).
- **Marginals:** for each label L, `countA(L)` / `countB(L)` are the two
  annotators' label counts over the pairs; `marginalA(L) = countA(L) / N`,
  `marginalB(L) = countB(L) / N`.
- **Expected agreement:** `pe = Σ_L marginalA(L) × marginalB(L)`. Each
  label's contribution is reported separately in the response.
- **Cohen's kappa:** `κ = (po − pe) / (1 − pe)`. When pe = 1 the
  denominator is 0: κ is defined as 1 when po = 1, else 0. When N = 0,
  po = pe = κ = 0.
- **Per-label agreement:** `agreedOn(L)` counts pairs where both chose L;
  `aOnly(L)` / `bOnly(L)` count disagreements where only A / only B
  chose L.
- **Bands** (Landis & Koch, on the rounded κ): < 0 `poor`, 0–0.20
  `slight`, 0.21–0.40 `fair`, 0.41–0.60 `moderate`, 0.61–0.80
  `substantial`, 0.81–1.00 `almost perfect`; no band when N = 0.
- All figures are rounded to 4 decimal places (`round4`).

Worked canonical example (seeded Dental Triage, verified in tests):
Zara's labels over DL-01…DL-10 are urgent ×5, routine ×5; Callum's are
urgent ×5, routine ×5; they match on 8 items. po = 0.8;
pe = 0.5×0.5 + 0.5×0.5 = 0.5; κ = (0.8 − 0.5) / (1 − 0.5) = **0.6**.

### 3.2 Annotator progress (`annotatorProgress`)

`percent = round4(100 × done / total)` where `done` counts assignments
with status `completed` (an annotation exists) and `total` counts all
assignments, for the requested scope (one schema, or the whole project);
0 when total = 0.

### 3.3 Final labels & export summary (`summariseFinalLabels`)

One final label per item, resolved in this fixed order:

1. the adjudication's final label, when one exists (`adjudicated`);
2. the shared label when ≥ 2 annotations exist and all agree (`agreed`);
3. the single annotation's label (`single-annotation`);
4. otherwise no final label — source `disagreement` (≥ 2 annotations
   that differ, no adjudication) or `unresolved` (no annotations).

The summary reports, per label, the count of items resolved to it and
`round4(100 × count / totalItems)`, plus the unresolved count and
percentage. Percentages are shares of **all** items in the schema.

### 3.4 Default agreement pair

Where a caller does not name a pair, agreement is measured between the
first two profiles with role `annotator` (by id) that hold assignments
on the schema. An explicit pair can be requested with
`?annotatorA=<id>&annotatorB=<id>` on the agreement endpoint.

## 4. Data model (11 tables)

| Table | Purpose / key columns |
|---|---|
| `users` | Accounts: name, unique email, role (`owner`/`staff`), `project_id`, scrypt password hash |
| `sessions` | Bearer tokens with expiry |
| `projects` | Labelling workspaces: name, unique slug, team, sector, location |
| `label_schemas` | `project_id`, ref, name, task, `labels` (JSON array) |
| `annotators` | `project_id`, name, email, role (`annotator`/`adjudicator`) |
| `items` | `schema_id`, `project_id`, ref, text, source |
| `assignments` | `project_id`, `schema_id`, `item_id`, `annotator_id`, status (`pending`/`completed`); unique (item, annotator) |
| `annotations` | One per assignment (unique `assignment_id`): item, annotator, label, note |
| `adjudications` | One per item (unique `item_id`): schema, final label, adjudicator, note |
| `exports` | Export records: schema, unique reference, title, summary text, headline kappa |
| `notifications` | Per-user notifications with read flag |

The DDL lives in `database/schema.sql` and is mirrored in
`backend/src/db.js` so the server is self-contained. Every domain row is
scoped by `project_id`; reads for another project's rows return 404.

## 5. Endpoint inventory (26 `/api/v1` endpoints + `GET /health`)

Auth (5): `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`,
`GET /auth/me`, `PUT /auth/me`.
Schemas & items (4): `GET /schemas`, `POST /schemas`, `GET /schemas/:id`,
`POST /schemas/:id/items`.
Annotators (2): `GET /annotators`, `POST /annotators`.
Items (2): `GET /items`, `GET /items/:id`.
Labelling (2): `POST /assignments`, `POST /annotations`.
Agreement & export (4): `GET /schemas/:id/agreement`,
`GET /schemas/:id/disagreements`, `POST /adjudications`,
`GET /schemas/:id/export-summary`.
Domain total: 4 + 2 + 2 + 2 + 4 = 14.
Workspace (7): `GET /dashboard`, `GET /project`, `PUT /project`,
`GET /exports`, `POST /exports`, `GET /notifications`,
`PATCH /notifications/read`.
Total: 5 + 14 + 7 = **26**, plus `GET /health`.

## 6. File inventory (40 files)

- Root (5): `README.md`, `PRD.md`, `TRD.md`, `VERIFICATION.md`,
  `PROJECT-DETAILS.md`
- Backend (16): `backend/README.md`, `backend/package.json`,
  `backend/src/server.js`, `backend/src/app.js`, `backend/src/db.js`,
  `backend/src/seed.js`, `backend/src/seed-data.js`,
  `backend/src/ai/engine.js`, `backend/src/middleware/auth.js`,
  `backend/src/middleware/errors.js`, `backend/src/middleware/validate.js`,
  `backend/src/routes/auth.js`, `backend/src/routes/labels.js`,
  `backend/src/routes/misc.js`, `backend/src/utils/respond.js`,
  `backend/src/utils/tokens.js`
- Database (3): `database/README.md`, `database/schema.sql`,
  `database/seed.sql`
- Web (3): `web/index.html`, `web/app.js`, `web/styles.css`
- Tests (1): `tests/run-tests.js`
- Preview (2): `preview/make_screenshots.py`, `preview/shot-config.json`
- Screenshots (10): `screenshots/01-dashboard.png` …
  `screenshots/10-settings-help.png`

## 7. Testing approach

`tests/run-tests.js` spawns the real server on a fresh temporary SQLite
database (unique temp directory per run, removed afterwards) and drives
it over HTTP. 54 checks cover: the seeded workspace's exact counts;
17 labelled expected-output cases (DL-01…DL-17) whose values are written
as literal fractions computed by hand from the fixtures — canonical
po/pe/κ (0.8 / 0.5 / 0.6), Ticket Intent κ 0.6364, progress percentages
at schema and project level, both export distributions, the
post-adjudication export shift, and a fresh-workspace fixture built
entirely through the API (po 0.75, pe 0.5, κ 0.5); adjudication and
annotation validation (400s); auth, role (403) and cross-project scoping
(404) behaviour; and the export-record, project and notification flows.
Every JavaScript file passes `node --check`.

## 8. Production notes

- The engine is deliberately dependency-free and deterministic: the same
  labels always produce the same po/pe/κ, which is what makes the
  hand-verified fixtures meaningful.
- In production, hosted model APIs (OpenAI, Anthropic, Google, Azure
  OpenAI) would plug in as a pre-labelling assistant behind the
  annotation endpoint — a suggested label the annotator confirms — and
  dataset exports would stream to the team's data platform. Neither
  changes the agreement maths, which operates on stored labels only.
- SQLite suits the single-workspace deployment shipped here; the data
  layer isolates all SQL behind `getDb()` so a move to a hosted database
  touches one module.
