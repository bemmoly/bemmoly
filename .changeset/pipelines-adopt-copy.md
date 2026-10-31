---
'@bemmoly/module-pipelines': minor
'@bemmoly/pipelines-web': minor
---

Pipelines adopts the Cloud Run services an environment already runs, deployed by hand or by
another CI, and copies configuration from one environment to another. Adopt services, on an
environment's row, lists each service in its project and region with the application it matches
by name and what adopting it would import; looking changes nothing in Google Cloud. Adopting
imports plain variables as they are, secrets as references to where they already live at their
pinned version (the value is never read), the scaling, CPU, memory, port and probe paths as that
environment's deploy settings, and the running image by digest as release zero, so the first
deploy rolls forward from it and a roll back can return to it. An address of another adopted
service can become `${{ apps.<key>.url }}`. A first deploy over a Cloud Run service of the same
name that nobody adopted now stops and says to adopt it first or rename the application.

Copy configuration plans every item that differs, per application or for all of them, with a
tick each. Plain variables and references copy as written. A secret is copied store to store
(read once in memory, written to the target's project, granted to what runs there, never kept)
or left needing a value, the default for a Prod-class target; a deploy stops until it has one.
Deploy settings are translated to the target's runtime, dropping what it lacks, and a lower
minimum than a Prod default starts unticked. The runtime choice, addresses and deployments are
never copied, copying again shows only what differs, and each copy is on What changed.

Adds `GET` and `POST /api/v1/pipelines/environments/:key/adoptions`, and `GET` and `POST
/environments/:key/copies`. Schema changeset `0029-pipelines-adopt-copy` lets a release's source
be `adopted` and lets a secret wait for its value; it is quick and reversible (going back
removes secrets still waiting for a value).
