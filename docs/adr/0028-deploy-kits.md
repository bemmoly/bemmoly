# ADR 0028: The Helm chart brings its own Postgres; Terraform runs the installer on one VM

- Status: accepted
- Date: 2026-10-11
- Tech design: [§18 Deploy](../tech-design.html#deploy) (Other paths, same image; Sizing; Updating)

## Context

§18 lists three paths beside the installer. For Helm it names "external Postgres or the
Bitnami/CloudNativePG subchart"; for Terraform, "AWS (EC2 + RDS), GCP (Compute + Cloud SQL)
and Hetzner (one VM)"; for air-gapped installs, a bundle the installer loads. Building them
showed three problems with that text:

- The Bitnami images and charts are no longer freely published, and CloudNativePG is an
  operator that must already run in the cluster, which a chart cannot install as a
  dependency. Neither gives a `helm install` that works on its own.
- A managed database per cloud means three different modules to maintain, test and keep
  equivalent, for the one part the installer already handles well on the VM (Postgres 18
  with pgvector, tuned, backed up). The install-in-five-minutes promise is about one VM.
- The bundle's images were never signed as a set, and an install that took images from a
  bundle had no supported way to update (the README advised a command the updater refused).

## Decision

1. **Helm.** The chart runs no subchart. `postgresql.enabled=true` adds one StatefulSet from
   the same `pgvector/pgvector:pg18` image Compose uses; `externalDatabase.url` or an
   `existingSecret` points at any other Postgres 18 with pgvector (managed, or an operator
   such as CloudNativePG). The chart refuses to render until one is chosen. It generates the
   secret key, backup passphrase and database password once and keeps them across upgrades
   (`lookup`) and uninstalls (`helm.sh/resource-policy: keep`), and keeps the data claim. A
   `pre-upgrade` Job runs the new version's changesets before any pod is replaced.
2. **Terraform.** One provider-free module (`deploy/terraform/modules/bemmoly-vm`) renders the
   cloud-init that runs the installer and imports email and backup settings
   (`bemmoly settings import`). Per-cloud examples are thin wrappers that create one VM and its
   firewall. No managed database; an external one is the installer's `--database-url`.
3. **Air-gapped.** Each bundle carries the CLI, the bundled models.dev catalog, `VERSION`,
   `images.txt`, `SHA256SUMS` over every file and a keyless cosign signature of `SHA256SUMS`
   (and the `.tar.gz` is signed as a release asset). The installer installs from a bundle
   offline (`--bundle`, or the bundle beside `install.sh`) and `bemmoly upgrade --bundle`
   updates one: it checks the bundle, loads the images and runs the usual updater flow on the
   loaded images, which stand in for the registry signature the updater checks on a pull.

## Consequences

- `helm install` with one flag gives a working install; production clusters bring their own
  Postgres as before. Live collaboration still needs one api replica (ADR 0014); the chart
  defaults to one and warns when raised.
- Settings made at install time (SMTP, S3 backups) have a command-line path that validates
  every value before writing any, usable by any automation, not only Terraform.
- Air-gapped installs update by CLI only; uploading a bundle in Settings › Updates remains
  later scope.
- CI installs the chart on kind, plans the Terraform with mocked providers and installs and
  upgrades from bundles with `--network none` (`.github/workflows/deploy-kits.yml`).

## Alternatives considered

- **CloudNativePG as a dependency.** Right for production, but it needs cluster-wide CRDs and
  an operator; the chart documents it as the external-database path instead.
- **Managed databases in Terraform.** Kept as something a user adds around the module.
