---
'@bemmoly/module-pipelines': minor
'@bemmoly/pipelines-web': minor
'@bemmoly/runner': minor
---

A runner pool can run on GKE Autopilot. In Platform › Capacity, add a pool or change where one
runs, choose GKE Autopilot, and name its project, region, cluster, runner image, vCPU and memory
per runner, Spot or standard capacity, pod service account, fewest and most runners and image
builder. Pipelines prepares the pool within a minute: it creates the Autopilot cluster in a CI
project it made when asked, or uses the one named, then writes the pool's namespace, the service
account its pods run as and a Workload Identity binding to the pod service account. When a job
waits in the pool, Pipelines starts one pod for it, with the runner, a container for each image
the job's steps run in, and Kaniko for image builds, and the pod ends with the job. An idle pool
has no pods. Fewest runners keeps that much room warm on the nodes. The pool's row shows its
pods running, starting and warm, live, and Builds now links each pod to GKE. Steps that run
Docker themselves, builds for platforms other than linux/amd64 and pull requests from forks do
not run on these pools. The runner gains a pod mode, read from `BEMMOLY_RUNNER_POD`, and its
image a `gke` target.

`POST /api/v1/pipelines/pools` and `PATCH /pools/:key` take `autopilot`, and pools carry it.
Schema changeset `0026-pipelines-autopilot-pools` lets a pool's hosting be `gke-autopilot`; it
is quick and reversible.
