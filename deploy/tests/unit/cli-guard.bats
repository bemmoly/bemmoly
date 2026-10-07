#!/usr/bin/env bats
# Host commands wait while the updater holds its lock, without touching Docker.

setup() {
  DEPLOY_DIR="$(cd "${BATS_TEST_DIRNAME}/../.." && pwd)"
  # shellcheck source=/dev/null
  . "${DEPLOY_DIR}/installer/lib/common.sh"
  for part in stack backups; do
    # shellcheck source=/dev/null
    . "${DEPLOY_DIR}/cli/lib/${part}.sh"
  done
  BEMMOLY_DIR="${BATS_TEST_TMPDIR}/bemmoly"
  BEMMOLY_LOG="${BATS_TEST_TMPDIR}/log"
  mkdir -p "${BEMMOLY_DIR}/data/updater"
  printf 'VERSION=1.2.0\n' >"${BEMMOLY_DIR}/.env"
  COMPOSE_CALLS="${BATS_TEST_TMPDIR}/compose"
  : >"${COMPOSE_CALLS}"
  compose() { printf '%s\n' "$*" >>"${COMPOSE_CALLS}"; }
  in_app() { printf 'in_app %s\n' "$*" >>"${COMPOSE_CALLS}"; }
}

hold_lock() { printf '1 2026-10-08T00:00:00Z\n' >"${BEMMOLY_DIR}/data/updater/lock"; }

@test "start, stop, restart, config set, backup and restore refuse during an update" {
  hold_lock
  for command in 'cmd_lifecycle start' 'cmd_lifecycle stop' 'cmd_lifecycle restart' \
    'cmd_config set LOG_LEVEL debug' 'cmd_backup' 'cmd_restore bemmoly-20261008 --yes'; do
    run ${command}
    [ "${status}" -eq 1 ]
    [[ "${output}" == *"An update or rollback is in progress"* ]]
    [[ "${output}" == *"Fix: Wait until it finishes"* ]]
  done
  [ ! -s "${COMPOSE_CALLS}" ]
  [ "$(env_get "${BEMMOLY_DIR}/.env" LOG_LEVEL)" = '' ]
}

@test "the same commands run when no update holds the lock" {
  run cmd_lifecycle restart
  [ "${status}" -eq 0 ]
  run cmd_backup
  [ "${status}" -eq 0 ]
  [ "$(cat "${COMPOSE_CALLS}")" = "$(printf 'restart\nin_app bemmoly-system backup --kind manual')" ]
}

@test "a lock left by a crash more than two hours ago is ignored" {
  hold_lock
  touch -t "$(date -v-3H +%Y%m%d%H%M 2>/dev/null || date -d '3 hours ago' +%Y%m%d%H%M)" \
    "${BEMMOLY_DIR}/data/updater/lock"
  run cmd_lifecycle stop
  [ "${status}" -eq 0 ]
  [ "$(cat "${COMPOSE_CALLS}")" = stop ]
}
