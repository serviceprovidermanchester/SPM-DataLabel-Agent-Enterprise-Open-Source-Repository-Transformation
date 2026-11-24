# DataLabel — Project Details

**Product:** DataLabel — Annotation & Agreement Studio
**Service line:** AI Development (Series 10, product 7 of 10)
**Built by:** SPManchester — https://spmanchester.com/
**Showcase team:** LabelWorks Manchester, Northern Quarter, Manchester (fictional; seeded local data)

## Summary

DataLabel turns "the annotators mostly agreed" into numbers. Teams define
label schemas, assign items to annotators, and watch progress per
annotator — then measure agreement properly: observed agreement (po),
agreement expected by chance from the annotators' own label marginals
(pe), and Cohen's kappa with the per-label counts behind every figure.
Disagreements become a review queue an adjudicator clears by setting
final labels, and the export summary reports the dataset's final-label
distribution with its unresolved share stated openly. The seeded
canonical fixture reproduces entirely by hand: 10 dental triage messages,
two annotators agreeing on 8, marginals of 0.5/0.5 each — po 0.8, pe 0.5,
kappa exactly 0.6.

## At a glance

- 40 files · 10 views · 10 screenshots (1440×900)
- 26 REST endpoints + `GET /health` · 11 SQLite tables
- 54 live tests, all passing, incl. 17 labelled expected-output cases
- Zero external dependencies (Node.js `node:http` / `node:sqlite` / `node:crypto`)
- Palette: plum `#4A154B` + rose `#F472B6` on `#FDF2F8`

## LinkedIn draft

"The annotators mostly agreed" is how noisy datasets ship. 🏷️

We built DataLabel — an annotation & agreement studio — for SPManchester's AI Development portfolio. It holds label schemas and item queues, tracks every annotator's progress, and measures inter-annotator agreement the honest way: observed agreement, chance agreement from the annotators' own label marginals, and Cohen's kappa with every count behind the headline exposed. Disagreements go to an adjudication queue, and the export states its unresolved share instead of hiding it.

Our seeded benchmark reproduces by hand: 10 patient messages, two annotators agreeing on 8 of them, marginals of 0.5/0.5 — po 0.8, pe 0.5, kappa exactly 0.6. 54 live tests, zero external dependencies, every figure traceable to the items that produced it.

[GitHub link]

#AIDevelopment #LLMOps #Manchester #SPManchester #AIEngineering #DataLabelling #MachineLearning #MLOps
