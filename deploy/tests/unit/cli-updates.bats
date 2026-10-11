#!/usr/bin/env bats
# bemmoly upgrade and rollback keep the updater's version in step with the app's.

setup() {
  DEPLOY_DIR="$(cd "${BATS_TEST_DIRNAME}/../.." && pwd)"
  # shellcheck source=/dev/null
  . "${DEPLOY_DIR}/installer/lib/common.sh"
  for part in stack updates; do
    # shellcheck source=/dev/null
    . "${DEPLOY_DIR}/cli/lib/${part}.sh"
  done
  BEMMOLY_DIR="${BATS_TEST_TMPDIR}/bemmoly"
  BEMMOLY_LOG="${BATS_TEST_TMPDIR}/log"
  ASSUME_YES=1
  mkdir -p "${BEMMOLY_DIR}"
  printf 'VERSION=1.3.0\nUPDATER_VERSION=1.3.0\n' >"${BEMMOLY_DIR}/.env"
  CALLS="${BATS_TEST_TMPDIR}/calls"
  : >"${CALLS}"
  compose() { printf 'compose %s\n' "$*" >>"${CALLS}"; }
  in_app() { printf '{}'; }
  # The command's own move is cli-self-update.bats's subject.
  cli_follow_release() { printf 'cli follows %s\n' "$1" >>"${CALLS}"; }
  json_field() {
    case "$1" in mode) printf schema ;; summary) printf 'Reverse 2 changesets' ;; esac
  }
  # The updater rewrites VERSION in .env to the version it started.
  run_updater() {
    printf 'updater %s\n' "$*" >>"${CALLS}"
    case "$1" in
      rollback) env_set "${BEMMOLY_DIR}/.env" VERSION 1.2.0 ;;
      upgrade) env_set "${BEMMOLY_DIR}/.env" VERSION "$2" ;;
    esac
  }
}

@test "a rollback keeps the updater on its newer release (ADR 0020)" {
  run cmd_rollback --yes
  [ "${status}" -eq 0 ]
  [ "$(env_get "${BEMMOLY_DIR}/.env" VERSION)" = 1.2.0 ]
  [ "$(env_get "${BEMMOLY_DIR}/.env" UPDATER_VERSION)" = 1.3.0 ]
  grep -qx 'updater rollback --expect schema' "${CALLS}"
  ! grep -q 'compose pull' "${CALLS}"
  grep -qx 'compose up -d' "${CALLS}"
}

@test "an upgrade by an updater with self-update leaves the move to it" {
  run_updater() {
    printf 'updater %s\n' "$*" >>"${CALLS}"
    env_set "${BEMMOLY_DIR}/.env" VERSION "$2"
    env_set "${BEMMOLY_DIR}/.env" UPDATER_VERSION "$2"
  }
  run cmd_upgrade 1.4.0 --yes
  [ "${status}" -eq 0 ]
  [ "$(env_get "${BEMMOLY_DIR}/.env" UPDATER_VERSION)" = 1.4.0 ]
  ! grep -q 'compose pull' "${CALLS}"
}

@test "sync-updater falls back to Compose for an updater without self-update" {
  printf 'VERSION=1.4.0\nUPDATER_VERSION=1.3.0\n' >"${BEMMOLY_DIR}/.env"
  run_updater() {
    printf 'updater %s\n' "$*" >>"${CALLS}"
    return 2
  }
  run cmd_sync_updater
  [ "${status}" -eq 0 ]
  grep -qx 'updater self-update 1.4.0' "${CALLS}"
  grep -qx 'compose pull --policy missing updater' "${CALLS}"
  [ "$(env_get "${BEMMOLY_DIR}/.env" UPDATER_VERSION)" = 1.4.0 ]
}

@test "an upgrade by an older updater still moves UPDATER_VERSION forward" {
  run cmd_upgrade 1.4.0 --yes
  [ "${status}" -eq 0 ]
  [ "$(env_get "${BEMMOLY_DIR}/.env" UPDATER_VERSION)" = 1.4.0 ]
  [[ "${output}" == *"Bemmoly 1.4.0 is running"* ]]
  grep -qx 'cli follows 1.4.0' "${CALLS}"
}

@test "an upgrade that rolled itself back leaves the bemmoly command alone" {
  run_updater() { printf 'updater %s\n' "$*" >>"${CALLS}"; }
  run cmd_upgrade 1.4.0 --yes
  [ "$(env_get "${BEMMOLY_DIR}/.env" VERSION)" = 1.3.0 ]
  refute() { if "$@"; then return 1; fi; }
  refute grep -q 'cli follows' "${CALLS}"
}
