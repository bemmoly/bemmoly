---
'@bemmoly/module-pipelines': minor
'@bemmoly/pipelines-web': minor
---

Everything Pipelines made on Google Cloud exports as Terraform and Helm you can run without it.
Platform › Export shows one directory per connection, with its files, the values to fill in
before a plan and what was left out, and downloads the whole bundle or one connection as a zip.
An application's page gains Export, for its services alone. The Terraform declares the landing
zone's projects, APIs, networks, log retention, budgets, identities and grants, the shared
registry, secrets (never their values), each Cloud Run service at its serving release, the
GKE clusters Pipelines created, each environment's front door and the Autopilot runner pools'
clusters and bindings, with an import block per resource so a plan adopts what runs
instead of creating it again. One Helm chart per catalog group renders what Pipelines deploys
to GKE, with a values file per application per environment, and a runner-pools chart holds
each Autopilot pool's namespace and service account. Revision history and the weights of a
canary or a move in flight are left out, and each export says so.

Adds `GET /api/v1/pipelines/exports` and `GET /exports/archive`, both for platform admins.
No schema change.
