# DataLabel — Verification

## Method

- `node --check` run over every JavaScript file in the product
  (backend, web, tests) — all pass.
- `node tests/run-tests.js` boots the real server (`backend/src/server.js`)
  on a fresh temporary SQLite database (unique temp directory per run,
  deleted afterwards) and drives the product over HTTP: seeded workspace
  values, 17 labelled expected-output cases (DL-01…DL-17) computed by
  hand from the fixtures as literal fractions, adjudication and
  annotation flows, auth/role/scoping behaviour, and a fresh-workspace
  agreement fixture built entirely through the API.
- Screenshots rendered with `python3 preview/make_screenshots.py`
  (PIL, 1440×900) from `preview/shot-config.json`, which carries the
  seeded workspace's real figures; the dashboard and agreement renders
  were visually inspected against the live API output (kappa 0.6,
  po 0.8, pe 0.5, per-label counts 5/5 with agreedOn 4/4 — all matching).

## Result

**54 passed, 0 failed**

## Key evidence (real values from the live run)

- Canonical Dental Triage fixture: po = 8/10 = **0.8**; both annotators'
  marginals 0.5/0.5 per label, pe contributions 0.25 + 0.25, pe = **0.5**;
  Cohen's kappa = (0.8 − 0.5) / (1 − 0.5) = **0.6** exactly, band
  *moderate*; per-label agreement urgent 4, routine 4.
- Ticket Intent fixture: 4 doubly-labelled items, po = **0.75**,
  pe = 0.125 + 0.125 + 0.0625 = **0.3125**, kappa = **0.6364**
  (*substantial*); progress Zara 6/8 = 75%, Callum 4/8 = 50%.
- Overall progress: Zara Ahmed 16/18 = **88.8889%**, Callum Reid
  14/18 = **77.7778%**.
- Exports before adjudication: triage urgent 4 (40%), routine 4 (40%),
  unresolved 2 (20%); intent billing 2 (25%), booking 1 (12.5%),
  clinical 2 (25%), unresolved 3 (37.5%).
- After adjudicating DL-05 as urgent: urgent 5 (**50%**), routine 4
  (40%), unresolved 1 (**10%**), open queue down from 2 to 1.
- Fresh-workspace fixture built over the API: po = 0.75, pe = 0.5,
  kappa = **0.5** exactly; first annotation reports progress 1/4 = 25%.
- Seeded workspace totals: 2 schemas, 18 items, 3 annotator profiles,
  36 assignments, 30 annotations, 3 open disagreements.

## Test output (full PASS list)

```
PASS  health reports 1 project, 2 schemas, 18 items, 30 annotations - schemas=2, items=18, annotations=30
PASS  seeded owner can sign in - owner@labelworks.co.uk
PASS  wrong password rejected - HTTP 401
PASS  schemas need sign-in - HTTP 401
PASS  dashboard stats: 2 schemas, 18 items, 3 annotators, 36 assignments, 30 annotations, 3 open disagreements - {"schemas":2,"items":18,"annotators":3,"assignments":36,"annotations":30,"adjudications":0,"openDisagreements":3}
PASS  dashboard headline is the triage kappa 0.6 (moderate) - kappa=0.6
PASS  triage schema holds 10 items / 20 annotations and intent 8 items / 10 annotations - triage=10/20, intent=8/10
PASS  triage detail lists DL-01..DL-10 in order - DL-01..DL-10
PASS  three annotator profiles are seeded (2 annotators + 1 adjudicator) - Zara Ahmed,Callum Reid,Priya Shah
PASS  DL-01 observed agreement po is exactly 8/10 = 0.8 - po=0.8, agreed=8
PASS  DL-02 marginals are 0.5/0.5 for both annotators, so pe = 0.25 + 0.25 = 0.5 - pe=0.5
PASS  DL-03 Cohen's kappa is exactly (0.8 - 0.5) / (1 - 0.5) = 0.6, band moderate - kappa=0.6
PASS  DL-04 per-label agreement: urgent agreed on 4, routine on 4, one solo each way per label - urgent=4, routine=4
PASS  DL-05 disagreement queue is exactly DL-05 (urgent vs routine) and DL-06 (routine vs urgent) - DL-05,DL-06
PASS  disagreements endpoint returns the same open queue of 2 with item text - open=2
PASS  DL-06 triage progress: Zara 10/10 = 100% and Callum 10/10 = 100% - Zara Ahmed 100%, Callum Reid 100%
PASS  DL-07 intent doubly-labelled set is 4 items with po = 3/4 = 0.75 - po=0.75, items=4
PASS  DL-08 intent pe = 0.125 + 0.125 + 0.0625 = 0.3125 from the two annotators' marginals - pe=0.3125
PASS  DL-09 intent kappa = (0.75 - 0.3125) / (1 - 0.3125) = 0.6364, band substantial - kappa=0.6364
PASS  DL-10 intent progress: Zara 6/8 = 75% and Callum 4/8 = 50% - 75%, 50%
PASS  DL-11 overall progress: Zara 16/18 = 88.8889% and Callum 14/18 = 77.7778% - 88.8889%, 77.7778%
PASS  DL-12 triage export: urgent 4 (40%), routine 4 (40%), unresolved 2 (20%) - [{"label":"urgent","count":4,"percent":40},{"label":"routine","count":4,"percent":40}] unresolved=2
PASS  DL-13 intent export: billing 2 (25%), booking 1 (12.5%), clinical 2 (25%), unresolved 3 (37.5%) - [{"label":"billing","count":2,"percent":25},{"label":"booking","count":1,"percent":12.5},{"label":"clinical","count":2,"percent":25}]
PASS  DL-14 final-label sources: DL-05 disagreement, TI-05 single-annotation billing, TI-07 unresolved - sources checked
PASS  generated export record carries kappa 0.6 and the triage distribution - HTTP 201, kappa=0.6
PASS  exports list holds the seeded export plus the generated one - count=2
PASS  adjudicating DL-05 as urgent returns 201 - HTTP 201
PASS  DL-15 after adjudication: urgent 5 (50%), routine 4 (40%), unresolved 1 (10%), queue down to 1 - urgent=5, unresolved=1
PASS  review queue now holds only DL-06 - DL-06
PASS  item detail for DL-05 shows both annotations and Priya Shah's adjudication - annotations=2
PASS  adjudicating with a label outside the schema is a 400 - HTTP 400
PASS  staff cannot update the project profile (owner only) - HTTP 403
PASS  register creates an owner with an empty workspace - HTTP 201
PASS  duplicate email rejected - HTTP 409 EMAIL_TAKEN
PASS  another project cannot read the seeded schema - HTTP 404
PASS  another project cannot read the seeded item - HTTP 404
PASS  another project cannot read the seeded agreement - HTTP 404
PASS  unknown schema is 404 - HTTP 404
PASS  unknown item is 404 - HTTP 404
PASS  two annotators are created in the new workspace with 201 - HTTP 201/201
PASS  new schema with inline items is created with 201 and 4 items - HTTP 201
PASS  eight assignments are created (4 items x 2 annotators) - count=8
PASS  first annotation reports progress 1/4 = 25% on the schema - progress={"done":1,"total":4,"percent":25}
PASS  DL-16 fresh fixture: po = 3/4 = 0.75 and pe = 0.5x0.25 + 0.5x0.75 = 0.5 - po=0.75, pe=0.5
PASS  DL-17 fresh fixture kappa = (0.75 - 0.5) / (1 - 0.5) = 0.5 exactly - kappa=0.5
PASS  an annotation with a label outside the schema is a 400 - HTTP 400 BAD_LABEL
PASS  a schema with fewer than two labels is a 400 - HTTP 400
PASS  adding an item to a schema returns 201 - HTTP 201
PASS  project profile is the Northgate Dental workspace in the Northern Quarter - LabelWorks Manchester · Northern Quarter, Manchester
PASS  owner can update the project profile - HTTP 200
PASS  seeded notifications are present - count=2
PASS  marking notifications read succeeds - markedRead=true
PASS  signed-in profile is Imogen Hart - Imogen Hart
PASS  logout succeeds - signedOut=true

54 passed, 0 failed
```

## Screenshots

10 PNGs in `screenshots/` (1440×900, 43–63 KB each), one per console
view: `01-dashboard.png`, `02-schemas.png`, `03-schema-detail.png`,
`04-annotators.png`, `05-queue.png`, `06-annotate.png`,
`07-agreement.png`, `08-disagreements.png`, `09-exports.png`,
`10-settings-help.png` — plum `#4A154B` + rose `#F472B6` design system
with the seeded LabelWorks Manchester data.
