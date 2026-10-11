---
'@bemmoly/deploy': minor
'@bemmoly/server': minor
---

Kubernetes, Terraform and air-gapped installs are now complete paths, each tested on every
change to the deploy kits.

The Helm chart can run its own Postgres 18 with pgvector (`postgresql.enabled=true`) or use
yours (`externalDatabase.url`), generates and keeps the secret key, backup passphrase and
database password across upgrades and uninstalls, runs pending changesets in a pre-upgrade Job
before any pod is replaced, adds a startup probe for long first boots, keeps the data volume on
uninstall, and has `helm test`. Every value is documented in the chart's README, including why
live collaboration needs one app replica for now. **Upgrading a release of an earlier chart**:
it defaulted `existingSecret` to `bemmoly`; pass `--set existingSecret=bemmoly` with
`--reset-then-reuse-values`. The chart refuses to render until it knows which database to use.

New Terraform: a provider-free module that runs the installer on one VM through cloud-init, with
inputs for the domain, the size, S3-compatible backups and SMTP, and thin examples for three
clouds (`deploy/terraform`).

Air-gapped bundles now carry the `bemmoly` CLI, the models.dev catalog snapshot, `VERSION`,
`images.txt`, checksums of every file and a cosign signature, and each bundle file is signed
as a release asset. `install.sh` installs offline from the bundle it sits in (or `--bundle`),
checking checksums and the signature first; `bemmoly upgrade --bundle <file>` upgrades offline
with the usual backup, health check and automatic rollback. New `bemmoly settings import <file>`
sets email and backup settings from a JSON file. Installs from a bundle set
`BEMMOLY_UPDATER_LOCAL_IMAGES=true` in `.env`. No schema change.
