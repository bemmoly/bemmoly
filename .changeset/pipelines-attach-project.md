---
'@bemmoly/module-pipelines': minor
'@bemmoly/pipelines-web': minor
'@bemmoly/runner': minor
'@bemmoly/core': minor
---

Pipelines can ship to a Google Cloud project you already have. Connect Google Cloud with
"Use projects I already have", attach a project (Pipelines checks what it can do there and says
what to grant), create environments that deploy into it, and set the path each tier's releases
take. A step marked auto-promote now promotes by itself, never to production. When the
connection names an image registry, runners build for the deploy platform, push the image and
release it by its digest, and Cloud Run revisions take the application's port, CPU, memory,
health check and public access. Private repositories check out with a read-only token for that
repository alone. Bemmoly can sign in to Google Cloud with your own gcloud credentials on a
laptop install.

Adds `POST /api/v1/pipelines/environments`, `PATCH` and `DELETE /environments/:key`,
`PUT /environments/paths/:tier`, `PATCH /clouds/:id`, `POST /clouds/:id/accounts`,
`POST /clouds/:id/accounts/:accountId/check` and `DELETE /clouds/:id/accounts/:accountId`.
Schema changeset `0020-pipelines-attached-accounts` adds four columns to `cloud_accounts`;
it is quick and reversible. Code hosts gain `readToken` in the module contract.
