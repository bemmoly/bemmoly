---
'@bemmoly/module-pipelines': minor
'@bemmoly/pipelines-web': minor
---

Applications have variables and secrets, for every environment or one, on a new Variables tab.
A plain variable is stored and shown; a secret's value goes straight to Secret Manager in the
environment's own project and is never shown again. Pipelines keeps only where it lives and its
version. Deploys mount plain values and secrets, pinned to their versions, into the Cloud Run
revision, grant whoever the service runs as read access to each secret, and record the set they
used, so a roll back that redeploys gets the same values. CI jobs read the secrets their steps
name from the store once, before the first step, and a fork still gets none. Changing a
protected environment's variables needs a Release manager or Platform admin. An attached
connection chooses the project that holds CI secrets in Platform › Clouds.

Adds `GET /api/v1/pipelines/applications/:key/variables`, and `PUT` and `DELETE
/applications/:key/variables/:name`, with `?environment=` for one environment. `PATCH
/clouds/:id` takes `ciAccountId`. Schema changeset `0021-pipelines-secrets` adds `kind`,
`secret_account_id` and `problem` to `pipeline_variables` and `variables` to
`pipeline_deployments`; it is quick and reversible. It marks every value already stored as a
secret waiting to move: the `pipelines.variables-move` job writes each to Secret Manager and
clears it from the database every ten minutes, and the Variables tab says what any value still
waits for. Enable the Secret Manager API in each project Pipelines deploys to.
