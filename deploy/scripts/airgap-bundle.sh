#!/bin/sh
# Builds bemmoly-airgap-<version>-<arch>.tar.gz for installs without internet access:
# the four images (app, updater, Postgres 18 with pgvector, Caddy) as one OCI image archive
# (docker save), the one-file installer, the bemmoly command (as the release's tarball, with
# the signed release manifest that vouches for it when OUTDIR holds one, and unpacked in a
# layout it runs from), the bundled models.dev catalog snapshot, the Compose files, VERSION,
# images.txt (references and digests), SHA256SUMS over every file and, when signing,
# SHA256SUMS.sigstore.json.
#
#   sh deploy/scripts/airgap-bundle.sh <version> <outdir>
#   BEMMOLY_AIRGAP_PLATFORMS="linux/amd64 linux/arm64" sh deploy/scripts/airgap-bundle.sh 1.2.0 dist
#
#   BEMMOLY_AIRGAP_SIGN=keyless   sign SHA256SUMS and the .tar.gz with cosign (the release does)
#   BEMMOLY_AIRGAP_PULL=false     use images already loaded here instead of pulling
#   BEMMOLY_AIRGAP_PDF=true       also carry the optional PDF renderer image (the pdf profile)
#   BEMMOLY_AIRGAP_IMAGES_FROM=<images.tar>
#                                 reuse the image archive of a published bundle (one platform),
#                                 e.g. to test this checkout's installer against a release
#
# On the offline machine (Docker already installed):
#   tar -xzf bemmoly-airgap-1.2.0-amd64.tar.gz
#   sudo sh bemmoly-airgap-1.2.0-amd64/install.sh --domain bemmoly.internal
set -eu

VERSION="${1:?usage: airgap-bundle.sh <version> <outdir>}"
OUTDIR="${2:?usage: airgap-bundle.sh <version> <outdir>}"
PLATFORMS="${BEMMOLY_AIRGAP_PLATFORMS:-linux/amd64}"
SIGN="${BEMMOLY_AIRGAP_SIGN:-}"
PULL="${BEMMOLY_AIRGAP_PULL:-true}"
IMAGES_FROM="${BEMMOLY_AIRGAP_IMAGES_FROM:-}"
WITH_PDF="${BEMMOLY_AIRGAP_PDF:-false}"
DEPLOY_DIR=$(cd "$(dirname "$0")/.." && pwd)
REPO_DIR=$(cd "${DEPLOY_DIR}/.." && pwd)
CATALOG_DIR="${REPO_DIR}/packages/core/src/services/ai/catalog/bundled"
# Postgres and Caddy exactly as the Compose file names them, so the loaded tags match.
THIRD_PARTY=$(sed -n 's/^    image: \([a-z][^$]*\)$/\1/p' "${DEPLOY_DIR}/compose/docker-compose.yml" | tr '\n' ' ')
IMAGES="ghcr.io/bemmoly/bemmoly:${VERSION} ghcr.io/bemmoly/updater:${VERSION} ${THIRD_PARTY}"

# The optional renderer, pinned by digest in the Compose file; carried by its tag, which the
# offline install names in PDF_IMAGE.
# shellcheck disable=SC2016 # a literal ${PDF_IMAGE:- in the Compose file, not an expansion
PDF_REF=$(sed -n 's/^    image: \${PDF_IMAGE:-\(.*\)}$/\1/p' "${DEPLOY_DIR}/compose/docker-compose.yml")
PDF_TAG="${PDF_REF%@*}"
if [ "${WITH_PDF}" = true ]; then
  [ -n "${PDF_REF}" ] || {
    echo "airgap-bundle: no pdf image in the Compose file" >&2
    exit 1
  }
  IMAGES="${IMAGES} ${PDF_TAG}"
fi

[ "$(printf '%s' "${THIRD_PARTY}" | wc -w)" -eq 2 ] || {
  echo "airgap-bundle: expected the db and proxy images in the Compose file, found: ${THIRD_PARTY}" >&2
  exit 1
}
mkdir -p "${OUTDIR}"
OUTDIR=$(cd "${OUTDIR}" && pwd)
CLI="bemmoly-cli-${VERSION}.tar.gz"
[ -f "${OUTDIR}/${CLI}" ] || sh "${DEPLOY_DIR}/scripts/release-cli.sh" "${VERSION}" "${OUTDIR}"

# docker save --platform exists from Docker 28; the containerd image store needs it.
save_platform_flag() {
  if docker save --help 2>/dev/null | grep -q -- '--platform'; then printf -- '--platform=%s' "$1"; fi
}

for platform in ${PLATFORMS}; do
  arch="${platform#linux/}"
  name="bemmoly-airgap-${VERSION}-${arch}"
  work=$(mktemp -d)
  dir="${work}/${name}"
  mkdir -p "${dir}/catalog"
  if [ -n "${IMAGES_FROM}" ]; then
    cp "${IMAGES_FROM}" "${dir}/images.tar"
  else
    for image in ${IMAGES}; do
      [ "${image}" = "${PDF_TAG}" ] && continue
      if [ "${PULL}" != false ]; then
        echo "→ ${image} (${platform})"
        docker pull --quiet --platform "${platform}" "${image}" >/dev/null
      fi
    done
    # The renderer is pulled by its digest, then named by its tag for the archive.
    if [ "${WITH_PDF}" = true ] && [ "${PULL}" != false ]; then
      echo "→ ${PDF_REF} (${platform})"
      docker pull --quiet --platform "${platform}" "${PDF_REF}" >/dev/null
      docker tag "${PDF_REF}" "${PDF_TAG}"
    fi
    # shellcheck disable=SC2046,SC2086 # one argument per image; the flag may be empty
    docker save $(save_platform_flag "${platform}") -o "${dir}/images.tar" ${IMAGES}
  fi
  # Every image with the digest of its manifest in the archive's OCI index.
  tar -xOf "${dir}/images.tar" index.json 2>/dev/null |
    jq -r '.manifests[] | "\(.annotations["io.containerd.image.name"]) \(.digest)"' >"${dir}/images.txt" || {
    echo "airgap-bundle: images.tar is not an OCI image layout; Docker 25 or later is needed" >&2
    exit 1
  }
  for image in ${IMAGES}; do
    grep -q "^\(docker.io/\(library/\)\{0,1\}\)\{0,1\}${image} " "${dir}/images.txt" || {
      echo "airgap-bundle: images.tar does not hold ${image}" >&2
      exit 1
    }
  done
  printf '%s\n' "${VERSION}" >"${dir}/VERSION"
  sh "${DEPLOY_DIR}/scripts/bundle-installer.sh" --version "${VERSION}" >"${dir}/install.sh"
  cp "${DEPLOY_DIR}/compose/docker-compose.yml" "${DEPLOY_DIR}/compose/Caddyfile" \
    "${DEPLOY_DIR}/compose/env.template" "${OUTDIR}/${CLI}" "${dir}/"
  # The release's signed manifest lists the command tarball's checksum (self-update --from).
  if [ -f "${OUTDIR}/release-manifest.json.sigstore.json" ]; then
    cp "${OUTDIR}/release-manifest.json" "${OUTDIR}/release-manifest.json.sigstore.json" "${dir}/"
  fi
  # The same command unpacked where it runs from, for installs whose own command predates
  # bundle upgrades: `sudo bash cli/bemmoly upgrade --bundle .`
  mkdir -p "${dir}/cli/lib" "${dir}/installer/lib"
  cp "${DEPLOY_DIR}/cli/bemmoly" "${DEPLOY_DIR}/cli/completion.bash" "${dir}/cli/"
  cp "${DEPLOY_DIR}"/cli/lib/*.sh "${dir}/cli/lib/"
  cp "${DEPLOY_DIR}/installer/lib/common.sh" "${DEPLOY_DIR}/installer/lib/preflight.sh" \
    "${DEPLOY_DIR}/installer/lib/bundle.sh" "${dir}/installer/lib/"
  # The models.dev catalog the app falls back to without internet; the image carries the same copy.
  cp "${CATALOG_DIR}"/catalog.json.gz "${CATALOG_DIR}"/logos.json.gz "${CATALOG_DIR}"/meta.json "${dir}/catalog/"
  cat >"${dir}/README.txt" <<EOF
Bemmoly ${VERSION} for ${platform}, for machines without internet access.

Docker Engine and the Compose plugin must already be installed. Then, from this folder:

  sudo sh install.sh --domain <hostname>

The installer finds the bundle beside it, checks every file against SHA256SUMS and the
signature in SHA256SUMS.sigstore.json (when cosign is installed), loads the images and
installs offline. Pass --trusted-root <trusted_root.json> to check the signature without
internet, or check it on a connected machine first:

  cosign verify-blob --bundle SHA256SUMS.sigstore.json \\
    --certificate-identity-regexp '^https://github\\.com/bemmoly/bemmoly/\\.github/workflows/release\\.yml@refs/(heads/main|tags/v.+)\$' \\
    --certificate-oidc-issuer https://token.actions.githubusercontent.com SHA256SUMS
  sha256sum -c SHA256SUMS

To upgrade an existing install to this version, copy the bundle over and run its CLI:

  sudo bash cli/bemmoly upgrade --bundle .

It takes a backup, loads the images, swaps the app and rolls back if it does not become
ready, then moves the installed bemmoly command to this release (${CLI}, checked
against the signed release-manifest.json). images.txt lists every image with its digest;
catalog/ holds the AI provider catalog this release ships with.
EOF
  if [ "${WITH_PDF}" = true ]; then
    cat >>"${dir}/README.txt" <<EOF

This bundle also carries the optional PDF renderer (${PDF_TAG}). To turn on Export as PDF,
add these to /var/bemmoly/.env, then run: sudo bemmoly restart

  COMPOSE_PROFILES=<the profiles already listed>,pdf
  PDF_IMAGE=${PDF_TAG}
  BEMMOLY_PDF_URL=http://pdf:3000
EOF
  fi
  (cd "${dir}" && find . -type f | sed 's|^\./||' | sort | xargs sha256sum >"${work}/SHA256SUMS")
  mv "${work}/SHA256SUMS" "${dir}/SHA256SUMS"
  if [ "${SIGN}" = keyless ]; then
    cosign sign-blob --yes --bundle "${dir}/SHA256SUMS.sigstore.json" "${dir}/SHA256SUMS"
  fi
  tar -czf "${OUTDIR}/${name}.tar.gz" -C "${work}" "${name}"
  if [ "${SIGN}" = keyless ]; then
    cosign sign-blob --yes --bundle "${OUTDIR}/${name}.tar.gz.sigstore.json" "${OUTDIR}/${name}.tar.gz"
  fi
  (cd "${OUTDIR}" && sha256sum "${name}.tar.gz" >"${name}.tar.gz.sha256")
  rm -rf "${work}"
  echo "✓ ${OUTDIR}/${name}.tar.gz"
done
