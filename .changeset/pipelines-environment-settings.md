---
'@bemmoly/module-pipelines': minor
'@bemmoly/pipelines-web': minor
---

Pipelines runs one definition differently per environment, so Stage can run on Cloud Run at zero
instances and Prod on GKE Autopilot. Each application has deploy settings per environment:
scaling (min and max; concurrency on Cloud Run; a CPU target on GKE), CPU and memory, the port,
a health path for liveness and a ready path for readiness, and whether secrets arrive as
environment variables or files. A value set on the application's Settings tab wins over
`deploy.environments.<key>` in `.bemmoly/application.yaml`, then the file's `deploy`, then the
runtime's default: zero instances on Cloud Run, two pods in a Prod-class environment on GKE and
one elsewhere. On GKE each revision now scales on a HorizontalPodAutoscaler instead of one fixed
replica, gets a PodDisruptionBudget from two pods up, and is reached in the cluster through a
stable Service named after the application. Secrets on GKE now arrive as environment variables
by default, synced into a Kubernetes Secret by the Secret Manager add-on, so the value also lives
in the cluster; `secretsAs: files` keeps the mount. Clusters need `--enable-secret-sync` for
this, and clusters Pipelines creates turn it on. A plain variable can name another
application's address as `${{ apps.<key>.url }}` or `${{ apps.<key>.publicUrl }}`, filled in per
environment at deploy time; a deploy naming one not yet deployed there stops and says so. The
environment dialog says what each runtime costs and who follows its default. The export writes
the same objects to Helm and Terraform.

Adds `GET /api/v1/pipelines/applications/:key/settings`, `PUT` and `DELETE
/applications/:key/settings/:environment`, and `GET /environments/:key/runtimes`. Schema
changeset `0028-pipelines-deploy-settings` adds the `pipeline_deploy_settings` and
`pipeline_service_addresses` tables; it is quick and reversible.
