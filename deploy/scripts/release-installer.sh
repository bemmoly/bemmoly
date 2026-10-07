#!/bin/sh
# Writes the installer's release assets: bemmoly-installer.sh (the one-file installer,
# with this release's Compose file and Caddyfile inside) and its SHA-256, which
# deploy/install.sh served at get.bemmoly.com downloads and checks.
#
#   sh deploy/scripts/release-installer.sh <version> <outdir>
set -eu

VERSION="${1:?usage: release-installer.sh <version> <outdir>}"
OUTDIR="${2:?usage: release-installer.sh <version> <outdir>}"
DEPLOY_DIR=$(cd "$(dirname "$0")/.." && pwd)

mkdir -p "${OUTDIR}"
sh "${DEPLOY_DIR}/scripts/bundle-installer.sh" --version "${VERSION}" >"${OUTDIR}/bemmoly-installer.sh"
(cd "${OUTDIR}" && sha256sum bemmoly-installer.sh >bemmoly-installer.sh.sha256)
echo "✓ ${OUTDIR}/bemmoly-installer.sh and its checksum"
