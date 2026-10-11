---
'@bemmoly/core': patch
---

Search indexing for "Ask your docs" no longer floods the job queue. While AI is off, no
embedding model is set, content sharing is off or the content sits in an excluded space or
project, changes queue nothing; turning AI on with an embedding model starts the backfill that
picks up everything. With indexing on, changes are collected per record and worked off by one
job per source, so seeding or importing thousands of issues queues a single job instead of one
per change. Index jobs left over from earlier versions finish at once without touching the
database while indexing cannot run.

Admins: the schema adds the kernel changeset `0601-ai-pending-embeddings` (the
`pending_embeddings` table). It is reversible and quick. Nothing existing is altered.
