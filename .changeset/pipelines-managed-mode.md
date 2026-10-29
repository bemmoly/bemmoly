---
'@bemmoly/module-pipelines': minor
'@bemmoly/pipelines-web': minor
---

Pipelines can create your Google Cloud projects from a single folder grant. Run
`deploy/gcp/bootstrap.sh` once: it makes the Bemmoly folder, grants Project Creator and Folder
Creator there and Billing Account User on one billing account, and prints the values to paste
into Connect › Create projects for me. The connection check tests exactly those permissions and
says for each one missing which role to grant and where. Choose Starter (a platform project,
one for non-production and one for production), Standard (a project per environment) or
Enterprise (per domain and environment). The plan shows every project, the shared registry and
the identities, and how many projects the billing account pays for against what it adds. A
billing account that is full stops the apply with how to ask Google for more, and Retry
resumes without creating anything twice. Choosing another layout later adds projects and moves
environments; it never deletes a project. A landing zone no longer takes over environments that
deploy into attached projects, and each project's deployer now holds Cloud Run Admin there so
public services deploy.

A managed connection now names its folder (`folderId`) and control project (`controlProject`);
connections that named only an organization keep working. Adds the `starter` layout and
`GET /api/v1/pipelines/clouds/:id/plans/:planId`. Schema changeset
`0024-pipelines-managed-layouts` adds the Starter layout, a `problems` column on
`cloud_connections`, `warnings` and `billing` on `cloud_landing_zone_plans`, and drops the
resource kind check on `cloud_resources`; it is quick and reversible.
