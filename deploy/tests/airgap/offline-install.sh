#!/bin/sh
# Offline install and upgrade from release bundles, on a machine with no network at all: a
# privileged Ubuntu container started with --network none that runs its own Docker. It
# installs the first bundle with the installer inside it (found beside install.sh, nothing
# pulled), creates the first admin, then upgrades with the second bundle's own CLI
# (`bemmoly upgrade --bundle`) and checks the version, the pre-upgrade backup and the data.
#
#   sh deploy/tests/airgap/offline-install.sh <from-bundle.tar.gz> <to-bundle.tar.gz>
#
# Build the bundles with deploy/scripts/airgap-bundle.sh for this machine's architecture.
# OFFLINE_DISK=/abs/path/disk.img keeps the test machine's Docker data in that file (on the
# host's disk) instead of a Docker volume. KEEP=1 leaves the test machine running.
set -eu

FROM_BUNDLE="${1:?usage: offline-install.sh <from-bundle.tar.gz> <to-bundle.tar.gz>}"
TO_BUNDLE="${2:?usage: offline-install.sh <from-bundle.tar.gz> <to-bundle.tar.gz>}"
HERE=$(cd "$(dirname "$0")" && pwd)
NAME="bemmoly-offline-test-$$"
IMAGE=bemmoly-offline-test:local
DOMAIN=bemmoly.internal

pass() { printf '✓ %s\n' "$*"; }
fail() {
  printf '✗ %s\n' "$*" >&2
  docker exec "${NAME}" sh -c 'cat /var/bemmoly/install.log /tmp/bemmoly-install.* 2>/dev/null | tail -40; docker ps -a' >&2 || true
  exit 1
}
cleanup() {
  [ -n "${KEEP:-}" ] && return 0
  docker rm -f --volumes "${NAME}" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

bundle_name() { basename "$1" .tar.gz; }
version_of() { bundle_name "$1" | sed 's/^bemmoly-airgap-\(.*\)-[a-z0-9]*$/\1/'; }
on() { docker exec "${NAME}" sh -c "$1"; }
api() { on "curl -ksS --max-time 10 --resolve ${DOMAIN}:443:127.0.0.1 $* "; }
ready() { api "https://${DOMAIN}/readyz" 2>/dev/null | grep -q '"status":"ready"'; }

FROM=$(version_of "${FROM_BUNDLE}")
TO=$(version_of "${TO_BUNDLE}")
BUNDLES_DIR=$(cd "$(dirname "${FROM_BUNDLE}")" && pwd)
[ "$(cd "$(dirname "${TO_BUNDLE}")" && pwd)" = "${BUNDLES_DIR}" ] || fail 'put both bundles in one folder'

docker build --quiet -t "${IMAGE}" "${HERE}" >/dev/null
set -- --volume "${BUNDLES_DIR}:/bundles:ro"
if [ -n "${OFFLINE_DISK:-}" ]; then
  set -- "$@" --volume "$(dirname "${OFFLINE_DISK}"):/disk" --env "OFFLINE_DISK=/disk/$(basename "${OFFLINE_DISK}")"
else
  set -- "$@" --mount type=volume,target=/var/lib/docker
fi
docker run --detach --privileged --network none --name "${NAME}" "$@" "${IMAGE}" >/dev/null
for _ in $(seq 1 60); do
  if on 'docker info' >/dev/null 2>&1; then break; fi
  sleep 1
done
on 'docker info' >/dev/null 2>&1 || fail 'the Docker engine inside the test machine did not start'

# No way out, no name resolution: nothing can be pulled. The only routes are the inner
# Docker's own bridges.
[ -z "$(on 'ip route show default; ip -6 route show default')" ] || fail 'the test machine has a default route'
[ "$(on 'ip -o link show | grep -cv -e " lo:" -e " docker0:" -e " br-"')" = 0 ] || fail 'the test machine has a network interface'
if on 'getent hosts ghcr.io' >/dev/null 2>&1; then fail 'the test machine resolves ghcr.io'; fi
if on 'curl -sS --max-time 5 https://ghcr.io' >/dev/null 2>&1; then fail 'the test machine reaches ghcr.io'; fi
[ -z "$(on 'docker images -q')" ] || fail 'the test machine already has images'
pass 'test machine: --network none, no route, no DNS, no images'

# --- install from the first bundle, found beside install.sh
on "tar -xzf /bundles/$(basename "${FROM_BUNDLE}") -C /var/tmp" || fail "could not unpack ${FROM_BUNDLE}"
on "sh /var/tmp/$(bundle_name "${FROM_BUNDLE}")/install.sh --domain ${DOMAIN} --yes" ||
  fail "the offline install of ${FROM} failed"
ready || fail "https://${DOMAIN}/readyz is not ready after the install"
[ "$(on 'sed -n s/^VERSION=//p /var/bemmoly/.env')" = "${FROM}" ] || fail "the install is not on ${FROM}"
[ "$(on 'sed -n s/^BEMMOLY_UPDATER_LOCAL_IMAGES=//p /var/bemmoly/.env')" = true ] ||
  fail 'the install from a bundle did not set BEMMOLY_UPDATER_LOCAL_IMAGES=true'
for image in "ghcr.io/bemmoly/bemmoly:${FROM}" "ghcr.io/bemmoly/updater:${FROM}" pgvector/pgvector:pg18 caddy:2.11; do
  on "docker image inspect ${image}" >/dev/null || fail "${image} was not loaded from the bundle"
done
pass "installed ${FROM} offline from the bundle (images loaded, HTTPS with a local certificate)"

password=$(head -c 18 /dev/urandom | base64 | tr -d '/+=')
api "-o /dev/null -w '%{http_code}' -H 'Origin: https://${DOMAIN}' -H 'Content-Type: application/json' \
  -d '{\"workspaceName\":\"Offline\",\"workspaceUrl\":\"https://${DOMAIN}\",\"name\":\"Offline Admin\",\"email\":\"admin@${DOMAIN}\",\"password\":\"${password}\"}' \
  https://${DOMAIN}/api/v1/setup/admin" | grep -q '^20' || fail 'creating the first admin failed'
api "https://${DOMAIN}/api/v1/setup/status" | grep -q '"initialized":true' || fail 'setup did not record the admin'
pass 'first admin created'
on 'bemmoly status' >/dev/null || fail 'bemmoly status failed'
pass 'bemmoly status'

# --- upgrade with the second bundle's own CLI
on "tar -xzf /bundles/$(basename "${TO_BUNDLE}") -C /var/tmp" || fail "could not unpack ${TO_BUNDLE}"
to_dir="/var/tmp/$(bundle_name "${TO_BUNDLE}")"
on "bash ${to_dir}/cli/bemmoly upgrade --bundle ${to_dir} --yes" || fail "bemmoly upgrade --bundle to ${TO} failed"
ready || fail "https://${DOMAIN}/readyz is not ready after the upgrade"
[ "$(on 'sed -n s/^VERSION=//p /var/bemmoly/.env')" = "${TO}" ] || fail "the install is not on ${TO} after the upgrade"
[ "$(on 'docker inspect --format "{{.Config.Image}}" bemmoly-bemmoly-1')" = "ghcr.io/bemmoly/bemmoly:${TO}" ] ||
  fail "the app container does not run ${TO}"
on 'ls /var/bemmoly/backups' | grep -q 'pre-upgrade' || fail 'no pre-upgrade backup was written'
api "https://${DOMAIN}/api/v1/setup/status" | grep -q '"initialized":true' || fail 'the workspace is gone after the upgrade'
pass "upgraded ${FROM} → ${TO} offline: pre-upgrade backup taken, workspace kept"
printf '  updater: %s\n' "$(on 'sed -n s/^UPDATER_VERSION=//p /var/bemmoly/.env')"

# --- a bundle that does not match its checksums is refused before anything changes
on "cp -r ${to_dir} /var/tmp/tampered && echo tampered >>/var/tmp/tampered/docker-compose.yml"
refused=$(on 'bash /var/tmp/tampered/cli/bemmoly upgrade --bundle /var/tmp/tampered --yes 2>&1' || true)
printf '%s' "${refused}" | grep -q 'does not match its checksums' || fail "a tampered bundle was not refused: ${refused}"
[ "$(on 'sed -n s/^VERSION=//p /var/bemmoly/.env')" = "${TO}" ] || fail 'a refused bundle changed the install'
pass 'a tampered bundle is refused and changes nothing'
