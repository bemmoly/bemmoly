#!/bin/sh
# An install whose bemmoly command predates self-update, in a throwaway container: the
# command of the real 0.11.0 release is refreshed with the installer, then follows an
# upgrade to a release served over HTTP and signed with a test key that the real cosign
# checks. A tampered manifest, an air-gap bundle and the updater's staged copy follow.
# Docker stands in for itself: the container gets a `docker` that only edits .env, so
# nothing here touches the machine's Docker beyond the one test container.
#
#   sh deploy/tests/container/cli-self-update.sh
set -eu

DEPLOY_DIR=$(cd "$(dirname "$0")/../.." && pwd)
IMAGE=bemmoly-test/cli-self-update:local
COSIGN_IMAGE=ghcr.io/sigstore/cosign/cosign:v3.1.3@sha256:9e5c2f2edc34351160407ca3416c61855bdf9403c3c5936e0f0be7fc261611b8
# The last release whose command could not update itself, as installs still run it.
OLD_RELEASE=0.11.0
OLD_INSTALLER_SHA256=b71cf1b34e0e34cda073be29a6f4ab46ecf787774b67bca30a4896309b3c3028

work=$(mktemp -d)
cleanup() {
  rm -rf "${work}"
  docker image rm "${IMAGE}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

old="${work}/bemmoly-installer-${OLD_RELEASE}.sh"
if [ -n "${BEMMOLY_OLD_INSTALLER:-}" ]; then
  cp "${BEMMOLY_OLD_INSTALLER}" "${old}"
else
  curl -fsSL --max-time 60 -o "${old}" \
    "https://github.com/bemmoly/bemmoly/releases/download/v${OLD_RELEASE}/bemmoly-installer.sh"
fi
actual=$(sha256sum "${old}" 2>/dev/null || shasum -a 256 "${old}")
[ "${actual%% *}" = "${OLD_INSTALLER_SHA256}" ] || {
  echo "✗ the ${OLD_RELEASE} installer does not match its pinned checksum" >&2
  exit 1
}

echo "→ Building the test container (Debian, bash, curl, python3, cosign)"
docker build --quiet -t "${IMAGE}" - >/dev/null <<EOF
FROM ${COSIGN_IMAGE} AS cosign
FROM debian:trixie-slim
RUN apt-get update -qq \\
 && apt-get install -y -qq --no-install-recommends bash curl ca-certificates python3 >/dev/null \\
 && rm -rf /var/lib/apt/lists/*
COPY --from=cosign /ko-app/cosign /usr/local/bin/cosign-real
EOF

# The old installer goes in on stdin: a temporary folder may not be shared with the VM
# that runs Docker (Colima, Docker Desktop).
# shellcheck disable=SC2016 # expanded inside the container
docker run --rm -i --network none -v "${DEPLOY_DIR}:/deploy:ro" "${IMAGE}" \
  sh -c 'mkdir -p /old && cat >/old/bemmoly-installer.sh && sh /deploy/tests/container/inside.sh' <"${old}"
