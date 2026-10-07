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

@test "a rollback moves UPDATER_VERSION back with the app" {
  run cmd_rollback --yes
  [ "${status}" -eq 0 ]
  [ "$(env_get "${BEMMOLY_DIR}/.env" VERSION)" = 1.2.0 ]
  [ "$(env_get "${BEMMOLY_DIR}/.env" UPDATER_VERSION)" = 1.2.0 ]
  grep -qx 'updater rollback --expect schema' "${CALLS}"
  grep -qx 'compose pull --policy missing updater' "${CALLS}"
  grep -qx 'compose up -d' "${CALLS}"
}

@test "an upgrade moves UPDATER_VERSION forward with the app" {
  run cmd_upgrade 1.4.0 --yes
  [ "${status}" -eq 0 ]
  [ "$(env_get "${BEMMOLY_DIR}/.env" UPDATER_VERSION)" = 1.4.0 ]
  [[ "${output}" == *"Bemmoly 1.4.0 is running"* ]]
}
