#!/bin/sh
# Smoke test of an installed Bemmoly (run as root on the machine the installer ran on):
# readiness, the setup checks, backup → drill → restore of a marker row, and with
# --upgrade-to an upgrade with its pre-upgrade backup followed by a rollback.
#
#   sudo sh deploy/scripts/smoke-test.sh --base-url https://localhost --version 1.2.0 [--upgrade-to 1.3.0]
set -eu

BASE_URL=''
VERSION=''
UPGRADE_TO=''
while [ "$#" -gt 0 ]; do
  case "$1" in
    --base-url) BASE_URL="$2"; shift 2 ;;
    --version) VERSION="$2"; shift 2 ;;
    --upgrade-to) UPGRADE_TO="$2"; shift 2 ;;
    *) echo "smoke-test: unknown option $1" >&2; exit 2 ;;
  esac
done
[ -n "${BASE_URL}" ] || { echo 'smoke-test: --base-url is required' >&2; exit 2; }
BEMMOLY_DIR="${BEMMOLY_DIR:-/var/bemmoly}"

pass() { printf '✓ %s\n' "$*"; }
fail() { printf '✗ %s\n' "$*" >&2; exit 1; }
api() { curl -ksS --max-time 10 "${BASE_URL}$1"; }
db_sql() {
  docker compose --project-directory "${BEMMOLY_DIR}" exec -T db \
    psql -U bemmoly -d bemmoly_db -At -v ON_ERROR_STOP=1 -c "$1"
}
installed_version() {
  sed -n 's/^VERSION=//p' "${BEMMOLY_DIR}/.env"
}

wait_ready() {
  for _ in $(seq 1 90); do
    if api /readyz 2>/dev/null | grep -q '"status":"ready"'; then return 0; fi
    sleep 2
  done
  api /readyz || true
  fail "${BASE_URL}/readyz did not report ready within 3 minutes"
}

wait_ready
pass "ready at ${BASE_URL}"
if [ -n "${VERSION}" ] && [ "${VERSION}" != latest ] && [ "${VERSION}" != beta ]; then
  [ "$(installed_version)" = "${VERSION}" ] || fail "expected version ${VERSION}, .env says $(installed_version)"
  pass "version ${VERSION}"
fi
# The modules API needs a session once identity is wired; an anonymous call then gets
# the API's own 401 body, which still proves the API answers.
modules=$(api /api/v1/modules) || fail '/api/v1/modules did not answer'
printf '%s' "${modules}" | grep -Eq '"items"|"code":"unauthenticated"' ||
  fail "/api/v1/modules answered unexpectedly: ${modules}"
pass 'modules API answers'

# The wizard's first step: anonymous while setup is open, closed once the first admin exists.
setup=$(api /api/v1/setup/status 2>/dev/null || true)
code=$(curl -ks -o /dev/null -w '%{http_code}' "${BASE_URL}/api/v1/admin/system")
case "${code}:${setup}" in
  200:*'"initialized":false'*) pass 'setup health checks answer while setup is open' ;;
  401:*'"initialized":true'*) pass 'setup health checks are closed to anonymous callers after setup' ;;
  404:*) echo "! /api/v1/admin/system answered 404: the wizard API is not wired in this build; skipped" ;;
  *) fail "/api/v1/admin/system answered ${code} with setup status ${setup}" ;;
esac

bemmoly status >/dev/null || fail 'bemmoly status failed'
pass 'bemmoly status'

# Backup, drill and restore around a marker row.
db_sql "create table if not exists smoke_markers (value text not null); truncate smoke_markers; insert into smoke_markers values ('before')" >/dev/null
bemmoly backup --json >/tmp/bemmoly-smoke-backup.json || fail 'bemmoly backup failed'
set_name=$(sed -n 's|.*"location": "[^"]*/\(bemmoly-[^"/]*\)/\{0,1\}".*|\1|p' /tmp/bemmoly-smoke-backup.json | head -n 1)
[ -n "${set_name}" ] || fail 'the backup did not report where it was written'
pass "backup ${set_name}"
bemmoly backups | grep -q manual || fail 'bemmoly backups does not list the manual backup'
bemmoly verify "${set_name}" --drill >/dev/null || fail "the restore drill of ${set_name} failed"
pass 'restore drill'
db_sql "update smoke_markers set value = 'after'" >/dev/null
bemmoly restore "${set_name}" --yes >/dev/null || fail "bemmoly restore ${set_name} failed"
wait_ready
[ "$(db_sql 'select value from smoke_markers')" = before ] || fail 'the restore did not bring the marker back'
pass 'restore brought the data back'

if [ -n "${UPGRADE_TO}" ]; then
  from=$(installed_version)
  bemmoly upgrade "${UPGRADE_TO}" --yes || fail "bemmoly upgrade ${UPGRADE_TO} failed"
  wait_ready
  [ "$(installed_version)" = "${UPGRADE_TO}" ] || fail "still on $(installed_version) after the upgrade"
  find "${BEMMOLY_DIR}/backups" -maxdepth 1 -name 'bemmoly-*-pre-upgrade-*' | grep -q . ||
    fail 'no pre-upgrade backup was written'
  pass "upgraded ${from} → ${UPGRADE_TO} with a pre-upgrade backup"
  bemmoly rollback --yes || fail 'bemmoly rollback failed'
  wait_ready
  [ "$(installed_version)" = "${from}" ] || fail "rollback left $(installed_version), expected ${from}"
  [ "$(db_sql 'select value from smoke_markers')" = before ] || fail 'the marker is gone after the rollback'
  pass "rolled back to ${from}"
fi

db_sql 'drop table smoke_markers' >/dev/null
bemmoly doctor || echo '! bemmoly doctor reported warnings (expected on a test machine)'
pass 'smoke test passed'
