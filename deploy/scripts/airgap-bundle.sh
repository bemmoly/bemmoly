#!/bin/sh
# Builds bemmoly-airgap-<version>-<arch>.tar.gz for installs without internet access:
# the four images (app, updater, Postgres 18 with pgvector, Caddy) as one docker-save
# archive, the one-file installer, the Compose file and checksums.
#
#   sh deploy/scripts/airgap-bundle.sh <version> <outdir>
#   BEMMOLY_AIRGAP_PLATFORMS="linux/amd64 linux/arm64" sh deploy/scripts/airgap-bundle.sh 1.2.0 dist
#
# On the offline machine (Docker already installed):
#   tar -xzf bemmoly-airgap-1.2.0-amd64.tar.gz && cd bemmoly-airgap-1.2.0-amd64
#   sudo sh install.sh --version 1.2.0 --image-archive images.tar --domain bemmoly.internal
set -eu

VERSION="${1:?usage: airgap-bundle.sh <version> <outdir>}"
OUTDIR="${2:?usage: airgap-bundle.sh <version> <outdir>}"
PLATFORMS="${BEMMOLY_AIRGAP_PLATFORMS:-linux/amd64}"
DEPLOY_DIR=$(cd "$(dirname "$0")/.." && pwd)
IMAGES="ghcr.io/bemmoly/bemmoly:${VERSION} ghcr.io/bemmoly/updater:${VERSION} pgvector/pgvector:pg18 caddy:2.11"

mkdir -p "${OUTDIR}"
OUTDIR=$(cd "${OUTDIR}" && pwd)

for platform in ${PLATFORMS}; do
  arch="${platform#linux/}"
  name="bemmoly-airgap-${VERSION}-${arch}"
  work=$(mktemp -d)
  mkdir -p "${work}/${name}"
  for image in ${IMAGES}; do
    echo "→ ${image} (${platform})"
    docker pull --quiet --platform "${platform}" "${image}" >/dev/null
  done
  # shellcheck disable=SC2086 # one argument per image
  docker save -o "${work}/${name}/images.tar" ${IMAGES}
  sh "${DEPLOY_DIR}/scripts/bundle-installer.sh" --version "${VERSION}" >"${work}/${name}/install.sh"
  cp "${DEPLOY_DIR}/compose/docker-compose.yml" "${DEPLOY_DIR}/compose/Caddyfile" \
    "${DEPLOY_DIR}/compose/env.template" "${work}/${name}/"
  cat >"${work}/${name}/README.txt" <<EOF
Bemmoly ${VERSION} for ${platform}, for machines without internet access.

Docker Engine and the Compose plugin must already be installed. Then:

  sudo sh install.sh --version ${VERSION} --image-archive images.tar --domain <hostname>

Later updates: upload the next bundle in Settings › Updates, or copy it over and run
  sudo bemmoly config set BEMMOLY_UPDATER_LOCAL_IMAGES true
  sudo docker load -i images.tar && sudo bemmoly upgrade <version>
EOF
  (cd "${work}/${name}" && sha256sum images.tar install.sh docker-compose.yml Caddyfile env.template >SHA256SUMS)
  tar -czf "${OUTDIR}/${name}.tar.gz" -C "${work}" "${name}"
  rm -rf "${work}"
  echo "✓ ${OUTDIR}/${name}.tar.gz"
done
