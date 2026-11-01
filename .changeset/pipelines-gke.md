---
'@bemmoly/module-pipelines': minor
'@bemmoly/pipelines-web': minor
---

Pipelines can run applications on GKE beside Cloud Run. Each environment can have one cluster:
created by Pipelines through a managed connection (Autopilot or Standard, the Regular release
channel, a weekend maintenance window, Workload Identity, the Gateway API and the Secret
Manager add-on on), or attached
through an attached connection and only ever deployed into. Attaching checks the cluster and
says in one sentence what to turn on or grant. Each application chooses its runtime per
environment on its page, without a commit; `runtimes` in `.bemmoly/application.yaml` and an
environment default are the fallbacks, and Cloud Run stays the default. On GKE a deploy writes a
Deployment and a Service per revision into the catalog group's namespace, the canary split is
the weights on one HTTPRoute per application, roll back moves every request back at once, and
canaries are judged on the Gateway load balancer's numbers in Cloud Monitoring. Plain variables
are environment variables in the pods; secrets are mounted at their recorded versions by GKE's
Secret Manager add-on, as files under `/var/run/secrets/bemmoly/<NAME>` with `<NAME>_FILE`
naming each, and the pods' Workload Identity principal is granted read access to each one.

Adds `GET` and `POST /api/v1/pipelines/clusters`, `POST /clusters/:id/check`,
`DELETE /clusters/:id`, `GET /applications/:key/runtimes` and
`PUT /applications/:key/runtimes/:environment`, and `defaultRuntime` on environments. Schema
changeset `0022-pipelines-gke-runtimes` adds the `cloud_clusters` and
`pipeline_application_runtimes` tables and a column each to `pipeline_environments` and
`pipeline_applications`; it is quick and reversible.
