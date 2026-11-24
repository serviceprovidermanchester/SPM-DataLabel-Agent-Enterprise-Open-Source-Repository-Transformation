"use strict";
// Seed data for DataLabel. The showcase team is LabelWorks Manchester, a
// fictional annotation studio in the Northern Quarter labelling patient
// messages and support tickets for Northgate Dental Group, a fictional
// Manchester dental group. All schemas, items and annotations below are
// seeded local data: the two annotators' labels are fixed per item in
// ANNOTATIONS so every agreement figure is deterministic and
// hand-computable.
//
// Canonical fixture — the Dental Triage schema (10 items, labels urgent /
// routine), labelled by Zara Ahmed (annotator A) and Callum Reid
// (annotator B):
//   Zara:   urgent x5 (DL-01..DL-05), routine x5 (DL-06..DL-10)
//   Callum: urgent x5 (DL-01..DL-04, DL-06), routine x5 (DL-05, DL-07..DL-10)
//   They agree on DL-01..DL-04 and DL-07..DL-10 → agreed 8 of 10.
//   po = 8/10 = 0.8
//   pe = (0.5 x 0.5) + (0.5 x 0.5) = 0.5
//   kappa = (0.8 - 0.5) / (1 - 0.5) = 0.6 exactly → band "moderate"
//   Per-label agreement: urgent agreed on 4 items, routine on 4 items.
//   Disagreement queue: DL-05 (urgent vs routine) and DL-06 (routine vs
//   urgent). Export before adjudication: urgent 4 (40%), routine 4 (40%),
//   unresolved 2 (20%).
//
// Second fixture — Ticket Intent (8 items, labels billing / booking /
// clinical). Zara labels TI-01..TI-06, Callum labels TI-01..TI-04, so the
// doubly-labelled set is TI-01..TI-04: (billing,billing),
// (booking,booking), (billing,booking), (clinical,clinical).
//   po = 3/4 = 0.75; Zara marginals billing 0.5, booking 0.25, clinical
//   0.25; Callum marginals billing 0.25, booking 0.5, clinical 0.25;
//   pe = 0.125 + 0.125 + 0.0625 = 0.3125;
//   kappa = (0.75 - 0.3125) / (1 - 0.3125) = 0.6364 → band "substantial".
//   Progress on this schema: Zara 6/8 = 75%, Callum 4/8 = 50%.
//   Export: billing 2 (25%), booking 1 (12.5%), clinical 2 (25%),
//   unresolved 3 (37.5%) — TI-03 disagreement, TI-07 and TI-08 unlabelled.
const PRODUCT = {
  name: "DataLabel", tagline: "Measure agreement before you trust the labels",
  serviceId: "spm-aidev-datalabel-api",
  ownerName: "Imogen Hart", ownerEmail: "owner@labelworks.co.uk", ownerPassword: "Owner2026!",
  staffName: "Owen Doyle", staffEmail: "team@labelworks.co.uk", staffPassword: "Team2026!",
};
const PROJECT = {
  name: "Northgate Dental — Patient Message Labelling", slug: "northgate-dental-labelling",
  team: "LabelWorks Manchester", sector: "Annotation studio", location: "Northern Quarter, Manchester",
};

const TRIAGE_ITEMS = [
  ["DL-01", "Severe tooth pain since last night, I cannot sleep at all"],
  ["DL-02", "My filling fell out this morning and the tooth feels sharp"],
  ["DL-03", "Swelling on one side of my face is getting worse today"],
  ["DL-04", "I chipped a front tooth in a fall an hour ago"],
  ["DL-05", "Mild sensitivity to cold drinks for the past week"],
  ["DL-06", "Bleeding gums when I brush, no pain at all"],
  ["DL-07", "Please book my six-month check-up for next month"],
  ["DL-08", "Can I move my hygienist appointment to a Friday"],
  ["DL-09", "I would like a quote for teeth whitening, please"],
  ["DL-10", "Reminder received, see you at my routine exam on Tuesday"],
];
// [itemRef, Zara's label, Callum's label]
const TRIAGE_LABELS = [
  ["DL-01", "urgent", "urgent"],
  ["DL-02", "urgent", "urgent"],
  ["DL-03", "urgent", "urgent"],
  ["DL-04", "urgent", "urgent"],
  ["DL-05", "urgent", "routine"],
  ["DL-06", "routine", "urgent"],
  ["DL-07", "routine", "routine"],
  ["DL-08", "routine", "routine"],
  ["DL-09", "routine", "routine"],
  ["DL-10", "routine", "routine"],
];
const INTENT_ITEMS = [
  ["TI-01", "I was charged twice for my check-up in October"],
  ["TI-02", "Please book a hygienist appointment next week"],
  ["TI-03", "I need to pay for my implant consultation booking"],
  ["TI-04", "My brace feels loose, is that normal after a week"],
  ["TI-05", "Invoice for the crown treatment has the wrong total"],
  ["TI-06", "How long does root canal recovery usually take"],
  ["TI-07", "Can my daughter join the practice as a new patient"],
  ["TI-08", "Do you offer payment plans for orthodontics"],
];
// [itemRef, Zara's label or null, Callum's label or null]
const INTENT_LABELS = [
  ["TI-01", "billing", "billing"],
  ["TI-02", "booking", "booking"],
  ["TI-03", "billing", "booking"],
  ["TI-04", "clinical", "clinical"],
  ["TI-05", "billing", null],
  ["TI-06", "clinical", null],
  ["TI-07", null, null],
  ["TI-08", null, null],
];
const SCHEMAS = [
  { ref: "dental-triage", name: "Dental Triage — Urgent vs Routine",
    task: "Triage Northgate Dental patient messages into urgent or routine",
    labels: ["urgent", "routine"], items: TRIAGE_ITEMS, annotations: TRIAGE_LABELS },
  { ref: "ticket-intent", name: "Ticket Intent — Dental Support",
    task: "Classify Northgate Dental support tickets by intent",
    labels: ["billing", "booking", "clinical"], items: INTENT_ITEMS, annotations: INTENT_LABELS },
];
const ANNOTATORS = [
  { name: "Zara Ahmed", email: "zara@labelworks.co.uk", role: "annotator" },
  { name: "Callum Reid", email: "callum@labelworks.co.uk", role: "annotator" },
  { name: "Priya Shah", email: "priya@labelworks.co.uk", role: "adjudicator" },
];
module.exports = { PRODUCT, PROJECT, SCHEMAS, ANNOTATORS };
