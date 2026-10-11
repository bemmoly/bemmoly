# Deploying Bemmoly

Every path runs the same application image (tech design §18, ADR 0028).

| Path                                       | For                                                    | Where                                          |
| ------------------------------------------ | ------------------------------------------------------ | ---------------------------------------------- |
| `curl -fsSL https://get.bemmoly.com \| sh` | One Linux VM: Compose, Postgres, HTTPS, backups, CLI   | `install.sh`, `installer/`, `compose/`, `cli/` |
| Helm                                       | Kubernetes                                             | [`helm/bemmoly`](helm/bemmoly/README.md)       |
| Terraform                                  | One VM on a cloud, running the installer on first boot | [`terraform`](terraform/README.md)             |
| Air-gapped bundle                          | Machines without internet access                       | below                                          |

Sizing, from the tech design: up to 50 people on 1 vCPU and 2 GB; up to 200 on 2 vCPU and
4 GB; up to 1,000 on 4 vCPU and 8 GB, with Postgres on its own machine recommended. Beyond
that, Helm with a managed Postgres.

## PDF export (optional)

Docs' Export as PDF can use a headless Chromium renderer that runs beside the app as its own
service ([ADR 0034](../docs/adr/0034-pdf-export-through-an-optional-renderer.md)). It is off
by default so the app image stays small. Without it, the More menu has no Export as PDF and
the export dialog's PDF choice opens the browser's print view, one page at a time.

With it, people get a PDF file on A4 or Letter with the title and page numbers on every
page, a contents page for a page and the pages under it, coloured code, tables, images and
issue chips. One page downloads when it is ready; a bigger export arrives in the inbox with a
link. Files are kept for a day.

The renderer (`gotenberg/gotenberg:8.37.0-chromium`, pinned by digest) is locked down: no host
name resolves, it loads nothing but the HTML the app sends (images travel inside it), JavaScript
is off, and it runs non-root with a read-only file system, no Linux capabilities and memory and
process limits, on a network with no route out. Allow about 1 GB of memory for it.

**Compose** (the installer's `/var/bemmoly`): add `pdf` to `COMPOSE_PROFILES` and set the URL in
`.env`, then restart:

```sh
# /var/bemmoly/.env
COMPOSE_PROFILES=db,proxy,updater,pdf
BEMMOLY_PDF_URL=http://pdf:3000
# Optional: BEMMOLY_PDF_TIMEOUT_MS=60000, BEMMOLY_PDF_MAX_BYTES=52428800

sudo bemmoly restart
```

**Helm**: `--set pdf.enabled=true`. The chart adds the renderer's Deployment and Service, sets
`BEMMOLY_PDF_URL` on the app, and (with `pdf.networkPolicy`, on by default) a NetworkPolicy
that lets only the app's pods in and the renderer nothing out. See the chart's
[values](helm/bemmoly/README.md#values).

**Air-gapped**: build the bundle with `BEMMOLY_AIRGAP_PDF=true` to carry the renderer image;
its README.txt lists the three `.env` lines (the profile, `PDF_IMAGE` and the URL). Bundles
built without it leave PDF as the browser's print view.

## Air-gapped installs

Each release publishes `bemmoly-airgap-X.Y.Z-amd64.tar.gz` and `…-arm64.tar.gz`, each with a
`.sha256` and a cosign signature (`.sigstore.json`). A bundle holds:

| File                                                                     | What it is                                                                                                                      |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `images.tar`                                                             | The app, updater, Postgres (pgvector) and Caddy images as one OCI image archive                                                 |
| `images.txt`                                                             | Each image and the digest of its manifest in that archive                                                                       |
| `install.sh`                                                             | The one-file installer of this release                                                                                          |
| `cli/`, `installer/lib/`                                                 | The `bemmoly` CLI, runnable from the bundle (`bash cli/bemmoly …`)                                                              |
| `bemmoly-cli-X.Y.Z.tar.gz`, `release-manifest.json` (+ `.sigstore.json`) | The same command as the release asset, and the signed manifest that lists its checksum (`bemmoly self-update --from`, ADR 0024) |
| `catalog/`                                                               | The models.dev catalog snapshot the app falls back to without internet (also in the image)                                      |
| `docker-compose.yml`, `Caddyfile`, `env.template`                        | The files the installer writes, for review                                                                                      |
| `VERSION`, `README.txt`                                                  | The version, and these instructions in short                                                                                    |
| `SHA256SUMS`, `SHA256SUMS.sigstore.json`                                 | Checksums of every file, and the release workflow's keyless signature over them                                                 |

### Check the bundle

On a machine with internet access and [cosign](https://docs.sigstore.dev/cosign/system_config/installation/),
before carrying it in:

```sh
cosign verify-blob --bundle bemmoly-airgap-X.Y.Z-amd64.tar.gz.sigstore.json \
  --certificate-identity-regexp '^https://github\.com/bemmoly/bemmoly/\.github/workflows/release\.yml@refs/(heads/main|tags/v.+)$' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  bemmoly-airgap-X.Y.Z-amd64.tar.gz
```

The installer and `bemmoly upgrade --bundle` check `SHA256SUMS` every time, and the signature
over it whenever cosign is available (on the host, or for upgrades the one inside the
installed updater image). Without internet, cosign needs Sigstore's trust root as a file:
after the check above, the connected machine has it at
`~/.sigstore/root/tuf-repo-cdn.sigstore.dev/targets/trusted_root.json`. Copy it over with
the bundle and pass `--trusted-root trusted_root.json`. If you checked the signature on
another machine and have no cosign here, the installer says so and goes on; with cosign but
no trust root, pass `--skip-signature-check`.

### Install

Docker Engine and the Compose plugin must already be installed (from your package mirror:
`docker-ce` and `docker-compose-plugin`, or `docker.io` and `docker-compose-v2`). Then:

```sh
tar -xzf bemmoly-airgap-X.Y.Z-amd64.tar.gz
sudo sh bemmoly-airgap-X.Y.Z-amd64/install.sh --domain bemmoly.internal
```

The installer finds the bundle beside it (or takes `--bundle FILE`), checks it, loads the
images and installs without pulling anything or resolving `ghcr.io`. The version is the
bundle's. A name that cannot get a public certificate gets Caddy's own, and browsers warn
until you trust Caddy's root or put your own certificate in front. `.env` records
`BEMMOLY_UPDATER_LOCAL_IMAGES=true`, so the updater never tries to pull.

AI works with a provider on your network, for example Ollama, with
`BEMMOLY_ALLOW_PRIVATE_URLS=true` (`sudo bemmoly config set BEMMOLY_ALLOW_PRIVATE_URLS true`).

### Upgrade

Copy the next release's bundle over and run **its** CLI, which also works on installs whose
own CLI predates bundle upgrades:

```sh
tar -xzf bemmoly-airgap-X.Y.Z-amd64.tar.gz
sudo bash bemmoly-airgap-X.Y.Z-amd64/cli/bemmoly upgrade --bundle bemmoly-airgap-X.Y.Z-amd64
```

It checks the bundle, loads its images, then runs the same upgrade as `bemmoly upgrade`: a
pre-upgrade backup, the swap, pending changesets, the health check, and the automatic
rollback when the new version is not ready within 3 minutes. Then the installed `bemmoly`
command moves to the bundle's release, checked against the signed manifest (ADR 0024); if
that copy does not check out, the command says so and `sudo sh <bundle>/install.sh
--refresh-cli` moves it. `bemmoly rollback` works as on any install. Settings › Updates
cannot take a bundle yet: without internet the app sees no newer version, and updates go
through this command.

## Tests

| What                          | How                                                                               |
| ----------------------------- | --------------------------------------------------------------------------------- |
| Installer, CLI, bundle checks | `pnpm --filter @bemmoly/deploy test` (bats), `pnpm --filter @bemmoly/deploy lint` |
| Helm chart on kind            | `sh tests/helm/kind-install.sh <from> <to>`                                       |
| Offline install and upgrade   | `sh tests/airgap/offline-install.sh <from-bundle> <to-bundle>`                    |
| Terraform                     | `sh terraform/check.sh`                                                           |

The last three run in `.github/workflows/deploy-kits.yml` on changes to `deploy/` and
nightly, against the two newest releases. The offline test runs an Ubuntu machine with
`--network none` and its own Docker, installs from the first bundle, creates the first
admin, upgrades with the second bundle's CLI, and checks that a changed bundle is refused.
