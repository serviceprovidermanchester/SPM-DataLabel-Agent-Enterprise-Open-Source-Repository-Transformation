# DataLabel — Product Requirements Document

**Product:** DataLabel — Annotation & Agreement Studio
**Service line:** AI Development (Series 10, product 7 of 10)
**Built by:** SPManchester — https://spmanchester.com/

## 1. Users

- **AI / ML team leads** preparing training and evaluation datasets who
  need evidence that the labels can be trusted before a model trains on
  them.
- **Annotation coordinators** running a labelling queue: defining label
  schemas, assigning work, watching progress, clearing disagreements.
- **Annotators** working item queues against a fixed label set.
- **Adjudicators** (senior annotators) who settle disagreements with a
  final label and a recorded rationale note.

## 2. Problem

Labelled data quality is usually assumed, never measured. Two annotators
can work the same queue and disagree on a fifth of the items without
anyone noticing; a headline "90% agreement" can hide the fact that most
of it is expected by chance because both annotators lean on the majority
label. The dataset then trains or evaluates a model whose ceiling was set
by label noise nobody quantified. Teams need agreement measured with
chance correction (Cohen's kappa), the disagreements surfaced as work
rather than statistics, and an export that states how much of the dataset
is genuinely resolved.

## 3. Functional requirements

| # | Requirement | Acceptance criteria |
|---|---|---|
| FR-1 | Label schemas | A workspace holds multiple schemas; each schema has a name, a task description and an ordered label set of at least two labels. Creating a schema with fewer than two labels returns 400. |
| FR-2 | Annotation items | Items (text snippets) belong to a schema, carry a reference and source, and can be added individually or inline at schema creation. |
| FR-3 | Annotators & assignments | Annotator profiles have a role (annotator or adjudicator). Items are assigned to annotators; the same item/annotator pair is never duplicated. |
| FR-4 | Annotations | Submitting an annotation requires a label from the item's schema (anything else returns 400), stores an optional note, marks the assignment completed, and returns the annotator's updated progress. Re-submitting updates the existing annotation. |
| FR-5 | Progress | Progress is reported per annotator per schema and overall: done, total and percentage (100 × done / total, 4 dp). |
| FR-6 | Agreement | For any schema and annotator pair, the API returns the doubly-labelled item count, agreed/disagreed counts, po, pe with per-label marginals and pe contributions, Cohen's kappa, its interpretation band, per-label agreement counts and the disagreement list. |
| FR-7 | Disagreement queue | Items where the pair's labels differ and no adjudication exists are listed as the open queue for the schema. |
| FR-8 | Adjudication | An adjudicator sets a final label (must be in the schema, else 400) with their name and an optional note; the item leaves the queue and the export updates immediately. |
| FR-9 | Export summary | Per schema: every label's final-label count and percentage of all items, the unresolved count and percentage, and each item's final label with its source (adjudicated / agreed / single-annotation / disagreement / unresolved). Export records persist the summary text and headline kappa. |
| FR-10 | Accounts & scoping | Token auth with owner/staff roles; project profile updates are owner-only (staff get 403); every domain read is scoped to the caller's project and another project's rows return 404. |

## 4. Engine-behaviour requirements

- **EB-1 (kappa formula).** κ = (po − pe) / (1 − pe), where po is the
  observed agreement share over doubly-labelled items and pe is the sum
  over labels of marginalA(L) × marginalB(L) from the two annotators' own
  label counts. Documented in `backend/src/ai/engine.js` and the TRD.
- **EB-2 (edge cases).** With no doubly-labelled items, po, pe and κ are
  0 and no band is offered. When pe = 1, κ is 1 if po = 1 and 0 otherwise
  (the denominator is 0).
- **EB-3 (bands).** Landis & Koch bands on the rounded κ: < 0 poor,
  0–0.20 slight, 0.21–0.40 fair, 0.41–0.60 moderate, 0.61–0.80
  substantial, 0.81–1.00 almost perfect.
- **EB-4 (rounding).** All reported figures are rounded to 4 decimal
  places; percentages are 100 × share, also at 4 dp.
- **EB-5 (final-label order).** Adjudication > unanimous annotations
  (≥ 2, all equal) > single annotation > unresolved. The order is fixed
  and documented; unresolved items are never silently assigned a label.
- **EB-6 (canonical fixture).** The seeded Dental Triage schema must
  reproduce po = 0.8, pe = 0.5, κ = 0.6 exactly from its fixed seed
  labels, and the Ticket Intent schema po = 0.75, pe = 0.3125,
  κ = 0.6364.

## 5. KPIs

- Headline Cohen's kappa per schema, visible on the dashboard.
- Open disagreement count per schema and across the workspace.
- Annotator completion percentages per schema.
- Unresolved share of each export (target: driven down by adjudication,
  and always reported rather than hidden).
- Percentage of items with a final label (resolved share).

## 6. Honesty constraints

- All schemas, items and annotations shipped with the product are seeded
  local data for a fictional Manchester annotation studio labelling a
  fictional dental group's messages. No real client data is used or
  claimed.
- The agreement engine is real, deterministic local mathematics — it is
  not connected to any hosted model, and no live model result is claimed.
- Seeded labels are fixed per item precisely so every figure can be
  verified by hand; the docs say so wherever the figures appear.

## 7. Backlog (production engagement)

- Hosted model API integrations for pre-labelling assistance (OpenAI,
  Anthropic, Google, Azure OpenAI) behind the annotation interface, with
  human confirmation still required before a pre-label counts.
- Imports from, and exports to, the team's data platform and annotation
  tools (CSV/JSONL dataset export with per-item provenance).
- More than two annotators per item with Fleiss' kappa and pairwise
  kappa matrices; weighted kappa for ordinal label sets.
- Vector-database-backed duplicate / near-duplicate item detection
  (pgvector, Pinecone, Qdrant or Weaviate) to stop the same message being
  labelled twice.
- Gold-standard items seeded into queues for per-annotator accuracy
  tracking, and sampling-based quality audits.
