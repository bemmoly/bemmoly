---
'@bemmoly/module-pipelines': minor
'@bemmoly/pipelines-web': minor
---

Pipelines can put a front door in front of an environment: one Google Cloud load balancer with
a stable address, a host for each application released there, and a Google-managed
certificate when you name a domain. Turn it on in Platform › Environments; new Prod
environments start with one. Where a front door serves an application, switching its runtime
plans a move instead of waiting for the next deploy. The move's screen shows the steps, the
downtime (none), a dated estimate of the month's cost and what is untested, then deploys on the
new runtime, shifts traffic 10, 50 and 100 percent with the canary judge between steps, and
removes the old runtime after a hold. Pause, Continue and Roll back work at any step. Canaries
on GKE behind a front door move its weights too.

Adds `GET /api/v1/pipelines/front-doors`, `PUT /environments/:key/front-door`,
`GET /runtime-moves`, `GET /runtime-moves/:id` and `POST /runtime-moves/:id/start`, `/pause`,
`/continue` and `/rollback`. Schema changeset `0025-pipelines-front-doors` adds three tables;
it is quick and reversible. The front door has run only against recorded answers and the
simulator, not a real Google Cloud project.
