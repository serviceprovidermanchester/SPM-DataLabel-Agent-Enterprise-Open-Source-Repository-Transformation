# 10 — AI Development — Progress

All 10 products built 2026-11-11, each live-verified by its own suite against a fresh database, then personally re-verified by the coordinator (all 10 test suites re-run: **513 passed, 0 failed**; file counts; views == screenshots for every product; `node --check` on every JS file — 165 files, 0 failures; endpoint counts re-counted independently from route registrations and matching every builder's reported figure; table counts from schema.sql; smallest screenshot ~34 KB across the series; forbidden-word scan across the whole series — clean), zipped, and uploaded to Google Drive folder "10 - AI Development" under "SPManchester Portfolio Projects" (Drive listing verified afterwards — see the delivery report for the folder link and counts).

| # | Product | Files | Views = Screenshots | Endpoints | Tables | Tests | ZIP | Drive |
|---|---------|-------|-------|-----------|--------|-------|-----|-------|
| 1 | PromptStudio — prompt library & scorer | 42 | 10 = 10 | 27 | 11 | 54/54 ✅ | 0.48 MB | ✅ |
| 2 | RagBase — RAG knowledge-base builder | 43 | 10 = 10 | 28 | 11 | 42/42 ✅ | 0.58 MB | ✅ |
| 3 | EvalBench — evaluation harness | 40 | 10 = 10 | 25 | 11 | 51/51 ✅ | 0.49 MB | ✅ |
| 4 | VectorLab — vector search & clustering | 40 | 10 = 10 | 27 | 11 | 42/42 ✅ | 0.55 MB | ✅ |
| 5 | TokenLab — tokeniser & cost estimator | 40 | 10 = 10 | 27 | 12 | 48/48 ✅ | 0.44 MB | ✅ |
| 6 | AgentFlow — workflow builder & runner | 40 | 10 = 10 | 26 | 12 | 50/50 ✅ | 0.54 MB | ✅ |
| 7 | DataLabel — annotation & agreement | 40 | 10 = 10 | 26 | 11 | 54/54 ✅ | 0.49 MB | ✅ |
| 8 | GuardRail — safety filter & red-team | 40 | 10 = 10 | 27 | 12 | 66/66 ✅ | 0.51 MB | ✅ |
| 9 | ModelRouter — request router | 40 | 10 = 10 | 26 | 11 | 55/55 ✅ | 0.49 MB | ✅ |
| 10 | FeedbackLoop — feedback & drift monitor | 40 | 10 = 10 | 26 | 11 | 51/51 ✅ | 0.50 MB | ✅ |

Totals: 405 files, 100 views = 100 screenshots, 265 endpoints, 113 tables, 513 live tests passing (513/513). Every suite includes a block of labelled expected-output cases with concrete hand-computed values (14–28 per product — token-F1 scores, TF-IDF idf/cosine values and MRR fractions, accuracy/per-label F1 as exact fractions, k-means inertia traces, token counts and £ cost cases, guardrail halting points and trace strings, Cohen's kappa values, red-team threshold edges, routing scores and a budget landing on exactly £0.65, PSI values per drift band); each product's VERIFICATION.md gives its own count and full PASS list.

Notes:
- Each product has its own engine module (`backend/src/ai/engine.js`) implementing a different deterministic technique; the shared parts are the platform patterns (auth, routing, persistence, screenshot pipeline) from the earlier series.
- Screenshots are desktop 1440×900 PIL renders in each product's own design system with its real seeded data and engine output; builders visually spot-checked renders and fixed defects found during the build (a card-overflow in RagBase, layout defects in VectorLab, a paragraph overlap in FeedbackLoop were corrected and re-rendered).
- Frontend JS was syntax-checked and structurally verified; the AI engines and business rules were fully live-tested over HTTP against fresh databases, which is where the logic lives.
- Honesty: no product calls a hosted model or any external API, and none uses an API key. All corpora, datasets and traffic are seeded locally for fictional Manchester teams/businesses; hosted model endpoints (OpenAI, Anthropic, Google, Azure OpenAI) and vector databases plug in behind the documented interfaces in a production engagement, as listed in every PRD's backlog. Local machinery is described accurately — TF-IDF is TF-IDF, the safety filter is a policy-rule engine, the responder is a deterministic local responder — never inflated into a hosted LLM.
- Positioning: this series is developer/engineering-facing AI tooling, distinct from Series 05's business-facing AI products (see SERIES-PLAN.md).
- GitHub publishing is Ali's own step: PUBLISH-QUEUE.md lists the proposed repo name, description and topics for every product.
- **This series completes the SPManchester portfolio programme at 100/100 projects.** The portfolio-level summary is PORTFOLIO-100-COMPLETE.md in the parent folder, also uploaded to the master Drive folder.
