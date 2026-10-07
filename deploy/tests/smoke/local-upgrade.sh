#!/bin/sh
# End to end on a Linux machine you can throw away (a VM): build two versions of the
# images from this tree, install the first with the installer, then run the smoke test
# with an upgrade to the second and a rollback. Run as root; ports 80 and 443 free.
#
#   sudo sh deploy/tests/smoke/local-upgrade.sh [--keep]
set -eu

REPO=$(cd "$(dirname "$0")/../../.." && pwd)
FROM="${FROM:-0.1.0-dev.1}"
TO="${TO:-0.1.0-dev.2}"
KEEP=''
[ "${1:-}" = --keep ] && KEEP=1

for lib in common args preflight docker; do
  # shellcheck source=/dev/null
  . "${REPO}/deploy/installer/lib/${lib}.sh"
done
BEMMOLY_LOG=$(mktemp)
detect_os
ensure_docker

build() {
  version="$1"
  note "Building ghcr.io/bemmoly/bemmoly:${version} and the updater"
  docker buildx build --load --quiet -f "${REPO}/deploy/docker/Dockerfile" \
    --build-arg BEMMOLY_VERSION="${version}" -t "ghcr.io/bemmoly/bemmoly:${version}" "${REPO}" >/dev/null
  docker buildx build --load --quiet -f "${REPO}/deploy/updater/Dockerfile" \
    --build-arg BEMMOLY_VERSION="${version}" -t "ghcr.io/bemmoly/updater:${version}" "${REPO}" >/dev/null
}
build "${FROM}"
build "${TO}"

sh "${REPO}/deploy/install.sh" --yes --domain localhost --version "${FROM}"

# Locally built images are unsigned and not in a registry.
bemmoly config set BEMMOLY_ALLOW_UNSIGNED_UPDATES true
bemmoly config set BEMMOLY_UPDATER_LOCAL_IMAGES true

sh "${REPO}/deploy/scripts/smoke-test.sh" --base-url https://localhost --version "${FROM}" --upgrade-to "${TO}"

if [ -z "${KEEP}" ]; then
  note 'Tearing down'
  docker compose --project-directory /var/bemmoly down --volumes --remove-orphans >/dev/null 2>&1 || true
  systemctl disable --now bemmoly-backup.timer >/dev/null 2>&1 || true
  rm -rf /var/bemmoly /usr/local/bin/bemmoly /usr/local/lib/bemmoly \
    /etc/systemd/system/bemmoly-backup.service /etc/systemd/system/bemmoly-backup.timer
fi
success 'local upgrade smoke test passed'
