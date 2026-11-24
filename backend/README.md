# DataLabel backend

Zero-dependency Node.js backend (`node:http`, `node:sqlite`, `node:crypto`
only) plus the agreement engine in `src/ai/engine.js` and the static web
console it serves from `../../web`.

```bash
node src/server.js          # PORT env, default 4000
curl localhost:4000/health
node ../../tests/run-tests.js   # from the product root: tests/run-tests.js
```

Layout: `src/server.js` (HTTP server) · `src/app.js` (router, `/health`,
static serving) · `src/db.js` (SQLite schema) · `src/seed.js` +
`src/seed-data.js` (seeded showcase workspace, shared agreement/export
computation) · `src/ai/engine.js` (observed agreement, Cohen's kappa with
marginal-based pe, per-label agreement, annotator progress, final-label
export summaries) · `src/middleware/` (token auth, errors, validation) ·
`src/routes/` (`auth.js`, `labels.js`, `misc.js`) · `src/utils/` (JSON
responses, password hashing and tokens).
