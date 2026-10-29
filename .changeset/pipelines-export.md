---
'@bemmoly/module-pipelines': minor
'@bemmoly/pipelines-web': minor
---

Everything Pipelines made on Google Cloud exports as Terraform and Helm you can run without it.
Platform › Export shows one directory per connection, with its files, the values to fill in
before a plan and what was left out, and downloads the whole bundle or one connection as a zip.
An application's page gains Export, for its services alone. The Terraform declares the landing
zone's projects, APIs, networks, log retention, budgets, identities and grants, the shared
registry, secrets (never their values), each Cloud Run service at its serving release and the
GKE clusters Pipelines created, with an import block per resource so a plan adopts what runs
instead of creating it again. One Helm chart per catalog group renders what Pipelines deploys
to GKE, with a values file per application per environment. Revision history, the canary's
weights and the front door are left out, and each export says so.

Adds `GET /api/v1/pipelines/exports` and `GET /exports/archive`, both for platform admins.
No schema change.
