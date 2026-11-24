# DataLabel database

SQLite database accessed through Node's built-in `node:sqlite` module — no
external driver. `schema.sql` documents the 11 tables; the same DDL is
mirrored in `backend/src/db.js` so the server creates and migrates the
database itself on first start. `seed.sql` summarises the seeded dataset;
the executable seed lives in `backend/src/seed.js` + `seed-data.js`.

Tables: `users`, `sessions`, `projects`, `label_schemas`, `annotators`,
`items`, `assignments`, `annotations`, `adjudications`, `exports`,
`notifications`. Every domain row is scoped by `project_id`; reads for
another project's rows return 404.

Default location: `backend/data/datalabel.sqlite` (override with the
`DB_PATH` environment variable — the test harness uses a fresh temporary
database per run).
