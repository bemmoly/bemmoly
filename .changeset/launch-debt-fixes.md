---
'@bemmoly/core': minor
'@bemmoly/server': patch
'@bemmoly/module-work': patch
'@bemmoly/deploy': patch
---

Backups now include every uploaded file (page images, the workspace logo, issue attachments)
and restores put them back. Before this, uploads were left out of backups: the backup read a
folder the uploads are not stored in. Take a fresh backup after updating; older backups do not
contain uploads.

Uploads can now live in an S3-compatible bucket (AWS S3, R2, MinIO, B2): set the
`system.storage.backend` setting to `s3` and the new `BEMMOLY_STORAGE_S3_BUCKET`,
`BEMMOLY_STORAGE_S3_REGION`, `BEMMOLY_STORAGE_S3_ENDPOINT`, `BEMMOLY_STORAGE_S3_ACCESS_KEY_ID`,
`BEMMOLY_STORAGE_S3_SECRET_ACCESS_KEY`, `BEMMOLY_STORAGE_S3_FORCE_PATH_STYLE` and
`BEMMOLY_STORAGE_S3_PREFIX` keys. Backups copy the bucket's uploads into every backup, and a
restore writes them back to the bucket. Existing files are not moved between backends.

The monthly AI budget can no longer be overshot by calls made at the same time: standard and
strong calls reserve their estimated cost before they run, so calls at the limit are refused
with "budget reached" instead of all going through.

Live issue tables in documents load in one request instead of one per row. A page's
"Referenced in" list finds linking issues through an index instead of scanning every issue.
`GET /teams/:id` reports the team's real `memberCount` instead of 0.

Release images now carry the commit SHA and build time in their OCI labels
(`org.opencontainers.image.revision` and `.created`) instead of "unknown".

Schema changes: kernel changeset `0410-ai-budget-reservations` adds the
`ai_budget_reservations` table (reversible). Work changeset
`0024-work-issues-linked-pages-index` builds a GIN index on `issues` concurrently (reversible);
on a large workspace it reads every issue once while it builds, without blocking writes.
