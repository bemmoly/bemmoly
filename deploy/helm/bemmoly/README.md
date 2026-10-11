# Bemmoly Helm chart

Bemmoly on Kubernetes: the same application image as the one-machine install, as one
Deployment (`mode: all`) or an api and a worker Deployment (`mode: split`), with an optional
bundled Postgres 18 with pgvector. Each release publishes the chart as `bemmoly-X.Y.Z.tgz`
on [GitHub Releases](https://github.com/bemmoly/bemmoly/releases); its version is the app
version.

## Install

```sh
# A trial, or a small team: the chart runs Postgres too.
helm install bemmoly bemmoly-X.Y.Z.tgz --namespace bemmoly --create-namespace \
  --set postgresql.enabled=true \
  --set publicUrl=https://bemmoly.example.com \
  --set ingress.enabled=true --set ingress.host=bemmoly.example.com \
  --set ingress.className=traefik

# Your own Postgres 18 with pgvector and pg_trgm (managed, or an operator such as CloudNativePG).
helm install bemmoly bemmoly-X.Y.Z.tgz --namespace bemmoly --create-namespace \
  --set externalDatabase.url='postgres://bemmoly:PASSWORD@db.internal:5432/bemmoly_db' \
  --set publicUrl=https://bemmoly.example.com
```

The chart refuses to render until it knows where the database is. Open `publicUrl` and the
setup wizard asks for the first admin.

**Keep a copy of the Secret.** Without `existingSecret`, the chart generates
`<release>-secrets` with `BEMMOLY_SECRET_KEY` (it decrypts stored AI keys, SMTP passwords
and SSO secrets), `BEMMOLY_BACKUP_PASSPHRASE`, `DATABASE_URL` and, with the bundled
Postgres, `POSTGRES_PASSWORD`. Upgrades read the values back, so they never change.
Back it up outside the cluster:

```sh
kubectl --namespace bemmoly get secret bemmoly-secrets -o yaml > bemmoly-secret.yaml
```

## Values

| Key                                                                      | Default                                                                  | What it does                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `image.repository`, `image.tag`, `image.pullPolicy`                      | `ghcr.io/bemmoly/bemmoly`                                                | The app image; the tag defaults to the chart's `appVersion`.                                                                                                                                                                                 |
| `imagePullSecrets`                                                       | `[]`                                                                     | For a private mirror of the image.                                                                                                                                                                                                           |
| `mode`                                                                   | `all`                                                                    | `all`: one Deployment serves requests and runs jobs. `split`: an `api` Deployment behind the Service and a `worker` Deployment for jobs.                                                                                                     |
| `replicas.api`, `replicas.worker`                                        | `1`, `1`                                                                 | `replicas.api` also counts the pods of `mode: all`. Read "Replicas" before raising it.                                                                                                                                                       |
| `publicUrl`                                                              | `https://bemmoly.example.com`                                            | The address people open; links in email and the same-origin check on `/collab` use it.                                                                                                                                                       |
| `modules`                                                                | `''`                                                                     | Pins the enabled modules (`work,docs`); Settings › Modules turns read-only. Empty: chosen in the wizard.                                                                                                                                     |
| `existingSecret`                                                         | `''`                                                                     | A Secret you manage with `DATABASE_URL` and `BEMMOLY_SECRET_KEY` (and optionally `BEMMOLY_BACKUP_PASSPHRASE`, `BEMMOLY_METRICS_TOKEN`, and `POSTGRES_PASSWORD` for the bundled Postgres).                                                    |
| `externalDatabase.url`                                                   | `''`                                                                     | `postgres://…` of a Postgres 18 or later with pgvector and pg_trgm; stored in the generated Secret.                                                                                                                                          |
| `postgresql.enabled`                                                     | `false`                                                                  | A single Postgres 18 with pgvector as a StatefulSet. Good for trials and small teams; use a managed Postgres for production.                                                                                                                 |
| `postgresql.image.*`                                                     | `pgvector/pgvector:pg18`                                                 | The bundled Postgres image.                                                                                                                                                                                                                  |
| `postgresql.persistence.size`, `.storageClass`                           | `10Gi`, cluster default                                                  | Its claim. It outlives an uninstall, as StatefulSet claims do.                                                                                                                                                                               |
| `postgresql.sharedBuffers`, `.effectiveCacheSize`                        | `256MB`, `768MB`                                                         | Postgres tuning; raise both with `postgresql.resources.limits.memory`.                                                                                                                                                                       |
| `postgresql.resources`                                                   | 100m / 256Mi, limit 1Gi                                                  | Requests and limits of the Postgres pod.                                                                                                                                                                                                     |
| `migrations.atBoot`                                                      | `true`                                                                   | Each pod runs pending changesets before it serves, under an advisory lock, so several pods starting together are safe.                                                                                                                       |
| `migrations.preUpgradeJob`                                               | `true`                                                                   | A `pre-upgrade` hook Job runs the new version's changesets first: a failing changeset stops `helm upgrade` before any pod is replaced.                                                                                                       |
| `migrations.activeDeadlineSeconds`                                       | `900`                                                                    | How long that Job may run.                                                                                                                                                                                                                   |
| `persistence.enabled`, `.size`, `.storageClass`                          | `true`, `20Gi`                                                           | The volume for attachments and local backups. Off: an `emptyDir`, lost with the pod.                                                                                                                                                         |
| `persistence.accessMode`                                                 | `''`                                                                     | Empty: `ReadWriteOnce` for `mode: all`, `ReadWriteMany` for `mode: split` (api and worker share files).                                                                                                                                      |
| `persistence.keep`                                                       | `true`                                                                   | Keep the claim when the release is uninstalled.                                                                                                                                                                                              |
| `service.type`, `.port`, `.annotations`, `.sessionAffinity`              | `ClusterIP`, `80`                                                        | The Service in front of the api pods.                                                                                                                                                                                                        |
| `ingress.enabled`, `.className`, `.host`, `.annotations`, `.tlsSecret`   | off                                                                      | One rule for `host` with the prefix `/`, which covers the app, the API, `/ws` and `/collab`. For cert-manager, add its annotation and a `tlsSecret` name.                                                                                    |
| `updateStrategy`                                                         | rolling, surge 1                                                         | New pod first, then the old one stops. With `ReadWriteOnce` on several nodes use `type: Recreate`.                                                                                                                                           |
| `resources`                                                              | 250m / 512Mi, limit 1Gi                                                  | Requests and limits of each app pod.                                                                                                                                                                                                         |
| `pdf.enabled`                                                            | `false`                                                                  | The optional PDF renderer behind Export as PDF (a Deployment, a Service and, with `pdf.networkPolicy`, a NetworkPolicy that lets only the app in and nothing out). Off: PDF is the browser's print view. See deploy/README.md, "PDF export". |
| `pdf.image.*`, `pdf.resources`                                           | `gotenberg/gotenberg:8.37.0-chromium` by digest, 100m / 256Mi, limit 1Gi | The renderer image (mirror it for a private registry) and its pod's requests and limits.                                                                                                                                                     |
| `pdf.timeoutSeconds`, `pdf.maxBytes`                                     | `60`, `52428800`                                                         | The longest one render may take and the largest HTML sent or PDF kept; the app's limits follow them.                                                                                                                                         |
| `extraEnv`, `extraEnvFrom`                                               | `[]`                                                                     | More environment (`LOG_LEVEL`, `OTEL_EXPORTER_OTLP_ENDPOINT`, rate limits) or whole Secrets and ConfigMaps.                                                                                                                                  |
| `podAnnotations`, `podLabels`, `nodeSelector`, `tolerations`, `affinity` | empty                                                                    | Scheduling and metadata for the app pods (and `nodeSelector`, `tolerations` for Postgres and the Job).                                                                                                                                       |

## Replicas and live collaboration

Live collaboration in Docs (the `/collab` WebSocket) relays edits between the people
connected to the **same pod**. Two people editing one page through two different pods both
have their edits saved, but they do not see each other's typing until they reload. Until
the server relays edits between pods, run **one api replica** (`replicas.api: 1`, the
default; in `mode: split` the worker can scale freely).

If you need more than one api pod for availability, send every connection of a client to
one pod with session affinity, either on the Service (`service.sessionAffinity: ClientIP`,
which behind an Ingress pins everyone to one pod, since the Ingress is the client) or with
your Ingress controller's sticky sessions (cookie affinity in Traefik, NGINX or HAProxy).
Affinity keeps one person on one pod; it does not put two people on the same pod, so the
limit above still applies to people on different pods.

WebSockets need no extra Ingress setting on Traefik. Controllers that time out idle
connections after 60 seconds (NGINX-based ones) need a longer read timeout, for example
`nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"` and `proxy-send-timeout: "3600"`.

## Upgrades

Settings › Updates shows the new version, its notes and the command:

```sh
helm upgrade bemmoly bemmoly-X.Y.Z.tgz --namespace bemmoly --reset-then-reuse-values
```

Use `--reset-then-reuse-values` (Helm 3.14 or later), not `--reuse-values`: it starts from
the new chart's defaults and applies your values on top, so keys a newer chart adds have
values. `--reuse-values` keeps only the old release's values, and the templates then miss
the new keys.

The pre-upgrade Job runs the new changesets while the old pods keep serving (every
changeset stays compatible with the previous minor), then the pods roll one at a time.
`helm rollback` returns to the previous image; whether the database needs a schema rollback
or a restore is what `bemmoly-db plan` and Settings › Updates tell you.

**From charts before 0.12**: they defaulted `existingSecret` to `bemmoly` and had no
database option. Keep that Secret by passing it explicitly:

```sh
helm upgrade bemmoly bemmoly-X.Y.Z.tgz --namespace bemmoly --reset-then-reuse-values --set existingSecret=bemmoly
```

## Uninstall

```sh
helm uninstall bemmoly --namespace bemmoly
```

This removes the Deployments, the StatefulSet, the Services, the Ingress and the Job, and
**keeps** the generated Secret, the data claim and the Postgres claim, so nothing a backup
needs is lost by accident. Installing again under the same release name adopts them and the
workspace comes back. To remove everything, delete them too (or the namespace):

```sh
kubectl --namespace bemmoly delete secret bemmoly-secrets
kubectl --namespace bemmoly delete pvc bemmoly-data data-bemmoly-postgres-0
```

## Tested

`deploy/tests/helm/kind-install.sh` installs the chart on a kind cluster with Traefik and
checks the bundled Postgres and pgvector, the generated Secret, both claims, the probes,
the Ingress, the `/collab` WebSocket with and without a session, `helm test`, an upgrade
between two chart versions with the pre-upgrade Job, uninstall and reinstall. CI runs it
on changes to `deploy/` and nightly (`.github/workflows/deploy-kits.yml`).
