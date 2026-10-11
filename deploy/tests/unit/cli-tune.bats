#!/usr/bin/env bats
# bemmoly doctor notices Postgres tuned for another machine size; bemmoly tune re-applies it.

setup() {
  DEPLOY_DIR="$(cd "${BATS_TEST_DIRNAME}/../.." && pwd)"
  for lib in common preflight; do
    # shellcheck source=/dev/null
    . "${DEPLOY_DIR}/installer/lib/${lib}.sh"
  done
  for part in stack tune; do
    # shellcheck source=/dev/null
    . "${DEPLOY_DIR}/cli/lib/${part}.sh"
  done
  BEMMOLY_DIR="${BATS_TEST_TMPDIR}/bemmoly"
  BEMMOLY_LOG="${BATS_TEST_TMPDIR}/log"
  mkdir -p "${BEMMOLY_DIR}"
  # Installed on a 4 GB machine.
  printf 'COMPOSE_PROFILES=db,proxy,updater\nPG_SHARED_BUFFERS=512MB\nPG_EFFECTIVE_CACHE_SIZE=1536MB\n' \
    >"${BEMMOLY_DIR}/.env"
  CALLS="${BATS_TEST_TMPDIR}/calls"
  : >"${CALLS}"
  compose() { printf 'compose %s\n' "$*" >>"${CALLS}"; }
  machine() { CPU_COUNT=$1 MEM_MB=$2; }
  detect_resources() { machine 2 4096; }
  ASSUME_YES=''
}

@test "doctor is quiet when the tuning matches this machine" {
  machine 2 4096
  run check_postgres_tuning
  [ "${status}" -eq 0 ]
  [ -z "${output}" ]
}

@test "doctor ignores memory reported a little short" {
  machine 2 3936
  run check_postgres_tuning
  [ "${status}" -eq 0 ]
}

@test "doctor warns after a resize and names the fix" {
  machine 4 16384
  run check_postgres_tuning
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"shared_buffers 512MB"* ]]
  [[ "${output}" == *"4 vCPU, 16384 MB"* ]]
  [[ "${output}" == *"wants 2048MB and 6144MB"* ]]
  [[ "${output}" == *"Fix: sudo bemmoly tune"* ]]
}

@test "doctor honours the 128 MB floor on a small machine" {
  printf 'COMPOSE_PROFILES=db\nPG_SHARED_BUFFERS=128MB\nPG_EFFECTIVE_CACHE_SIZE=337MB\n' >"${BEMMOLY_DIR}/.env"
  machine 1 900
  run check_postgres_tuning
  [ "${status}" -eq 0 ]
}

@test "doctor leaves an external database alone" {
  printf 'COMPOSE_PROFILES=proxy,updater\nPG_SHARED_BUFFERS=512MB\n' >"${BEMMOLY_DIR}/.env"
  machine 8 32768
  run check_postgres_tuning
  [ "${status}" -eq 0 ]
}

@test "tune does nothing when the tuning already fits" {
  run cmd_tune
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"already tuned"* ]]
  [ ! -e "${BEMMOLY_DIR}/.env.bak" ]
  [ ! -s "${CALLS}" ]
}

@test "tune --yes writes the new values, keeps a backup and restarts only the database" {
  detect_resources() { machine 4 16384; }
  run cmd_tune --yes
  [ "${status}" -eq 0 ]
  [ "$(env_get "${BEMMOLY_DIR}/.env" PG_SHARED_BUFFERS)" = 2048MB ]
  [ "$(env_get "${BEMMOLY_DIR}/.env" PG_EFFECTIVE_CACHE_SIZE)" = 6144MB ]
  [ "$(env_get "${BEMMOLY_DIR}/.env.bak" PG_SHARED_BUFFERS)" = 512MB ]
  grep -qx 'compose up -d --no-deps db' "${CALLS}"
}

@test "tune without a terminal saves the values and leaves the restart to you" {
  detect_resources() { machine 4 16384; }
  restart_database_now() { return 1; }
  run cmd_tune
  [ "${status}" -eq 0 ]
  [ "$(env_get "${BEMMOLY_DIR}/.env" PG_SHARED_BUFFERS)" = 2048MB ]
  [[ "${output}" == *"sudo bemmoly restart"* ]]
  [ ! -s "${CALLS}" ]
}

@test "tune refuses an external database and unknown options" {
  run cmd_tune --frobnicate
  [ "${status}" -eq 1 ]
  printf 'COMPOSE_PROFILES=proxy\n' >"${BEMMOLY_DIR}/.env"
  run cmd_tune --yes
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"external database"* ]]
}
