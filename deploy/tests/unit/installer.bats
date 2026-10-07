#!/usr/bin/env bats
# Installer argument parsing and configuration, without touching the machine.

setup() {
  DEPLOY_DIR="$(cd "${BATS_TEST_DIRNAME}/../.." && pwd)"
  for lib in common args preflight config start; do
    # shellcheck source=/dev/null
    . "${DEPLOY_DIR}/installer/lib/${lib}.sh"
  done
  as_root() { "$@"; }
  asset() { cat "${DEPLOY_DIR}/compose/$1"; }
  BEMMOLY_LOG="${BATS_TEST_TMPDIR}/log"
}

@test "defaults: stable channel, /var/bemmoly, proxy and updater on" {
  parse_args
  [ "${CHANNEL}" = stable ]
  [ "${INSTALL_DIR}" = /var/bemmoly ]
  [ -z "${VERSION}${DOMAIN}${MODULES}${NO_PROXY}${NO_UPDATER}${ASSUME_YES}" ]
  [ "$(compose_profiles)" = db,proxy,updater ]
}

@test "every flag, in both spellings" {
  parse_args --domain bemmoly.acme.dev --version v1.2.0 --channel=beta --modules work,docs \
    --no-proxy --no-in-app-updates --dir=/srv/bemmoly --yes
  [ "${DOMAIN}" = bemmoly.acme.dev ]
  [ "${VERSION}" = 1.2.0 ]
  [ "${CHANNEL}" = beta ]
  [ "${MODULES}" = work,docs ]
  [ "${INSTALL_DIR}" = /srv/bemmoly ]
  [ "${ASSUME_YES}" = 1 ]
  [ "$(compose_profiles)" = db ]
}

@test "latest and beta are accepted as versions" {
  parse_args --version latest
  [ "${VERSION}" = latest ]
  parse_args --version beta
  [ "${VERSION}" = beta ]
}

@test "an external database drops the bundled one" {
  parse_args --database-url postgres://u:p@db.internal:5432/bemmoly_db
  [ "$(compose_profiles)" = proxy,updater ]
}

@test "bad values fail with a fix" {
  run parse_args --version 1.x
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"--version must look like 1.2.0"* ]]
  [[ "${output}" == *"Fix:"* ]]

  run parse_args --channel nightly
  [[ "${output}" == *"--channel must be stable or beta"* ]]

  run parse_args --modules 'Work, Docs'
  [[ "${output}" == *"comma-separated list"* ]]

  run parse_args --domain https://bemmoly.acme.dev/
  [[ "${output}" == *"must be a hostname"* ]]

  run parse_args --dir relative/path
  [[ "${output}" == *"absolute path"* ]]

  run parse_args --database-url mysql://x
  [[ "${output}" == *"postgres://"* ]]

  run parse_args --image-archive /does/not/exist.tar
  [[ "${output}" == *"Cannot read"* ]]

  run parse_args --domain
  [[ "${output}" == *"--domain needs a value"* ]]

  run parse_args --frobnicate
  [[ "${output}" == *"Unknown option: --frobnicate"* ]]
}

@test "--help prints the options and exits 0" {
  run parse_args --help
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"--no-in-app-updates"* ]]
  [[ "${output}" == *"--modules a,b"* ]]
}

@test "Postgres is tuned from memory: 4 GB gives 512MB and 1536MB" {
  MEM_MB=4096 tune_postgres
  [ "${PG_SHARED_BUFFERS}" = 512MB ]
  [ "${PG_EFFECTIVE_CACHE_SIZE}" = 1536MB ]
  MEM_MB=1900 tune_postgres
  [ "${PG_SHARED_BUFFERS}" = 237MB ]
  MEM_MB=900 tune_postgres
  [ "${PG_SHARED_BUFFERS}" = 128MB ]
}

@test "local names and addresses get the self-signed fallback" {
  [ "$(tls_mode_for localhost)" = internal ]
  [ "$(tls_mode_for bemmoly.test)" = internal ]
  [ "$(tls_mode_for 10.0.0.5)" = internal ]
  [ "$(tls_mode_for does-not-resolve.invalid)" = internal ]
}

@test "templates and .env edits" {
  export TPL_NAME=world
  [ "$(printf 'hello @NAME@, @NAME@!' | render_template)" = 'hello world, world!' ]
  file="${BATS_TEST_TMPDIR}/.env"
  printf 'A=1\nKEY=abc==\nB=2\n' >"${file}"
  env_set "${file}" KEY 'new/value+=='
  env_set "${file}" C 3
  [ "$(env_get "${file}" KEY)" = 'new/value+==' ]
  [ "$(env_get "${file}" A)" = 1 ]
  [ "$(env_get "${file}" C)" = 3 ]
  [ "$(wc -l <"${file}" | tr -d ' ')" = 4 ]
}

@test "env_set leaves the caller's variables alone (a re-run once emptied .env)" {
  tmp="${BATS_TEST_TMPDIR}/kept.env"
  printf 'VERSION=1.0.0\nPOSTGRES_PASSWORD=secret\nUPDATER_TOKEN=abc\n' >"${tmp}"
  env_set "${tmp}" VERSION 1.1.0
  env_set "${tmp}" COMPOSE_PROFILES db,proxy
  [ "${tmp}" = "${BATS_TEST_TMPDIR}/kept.env" ]
  [ "$(env_get "${tmp}" VERSION)" = 1.1.0 ]
  [ "$(env_get "${tmp}" POSTGRES_PASSWORD)" = secret ]
  [ "$(env_get "${tmp}" UPDATER_TOKEN)" = abc ]
  [ "$(env_get "${tmp}" COMPOSE_PROFILES)" = db,proxy ]
}

@test "a re-run keeps every secret and changes only what the flags say" {
  parse_args --domain bemmoly.acme.dev --version 1.2.0 --dir "${BATS_TEST_TMPDIR}/install"
  mkdir -p "${INSTALL_DIR}"
  MEM_MB=4096 tune_postgres
  TLS_MODE=auto
  new_env_file
  before=$(env_get "${INSTALL_DIR}/.env" BEMMOLY_SECRET_KEY)
  parse_args --version 1.3.0 --no-in-app-updates --dir "${INSTALL_DIR}"
  update_env_file
  env="${INSTALL_DIR}/.env"
  [ "$(env_get "${env}" BEMMOLY_SECRET_KEY)" = "${before}" ]
  [ -n "$(env_get "${env}" POSTGRES_PASSWORD)" ]
  [ "$(env_get "${env}" VERSION)" = 1.3.0 ]
  [ "$(env_get "${env}" COMPOSE_PROFILES)" = db,proxy ]
  [ "$(env_get "${env}" BEMMOLY_DOMAIN)" = bemmoly.acme.dev ]
}

@test "a new .env has every key, fresh secrets and mode 600" {
  parse_args --domain bemmoly.acme.dev --modules work --version 1.2.0 --dir "${BATS_TEST_TMPDIR}/install"
  mkdir -p "${INSTALL_DIR}"
  MEM_MB=4096 tune_postgres
  TLS_MODE=auto
  new_env_file
  env="${INSTALL_DIR}/.env"
  [ "$(stat -c %a "${env}" 2>/dev/null || stat -f %Lp "${env}")" = 600 ]
  ! grep -q '@[A-Z_]*@' "${env}"
  [ "$(env_get "${env}" VERSION)" = 1.2.0 ]
  [ "$(env_get "${env}" COMPOSE_PROFILES)" = db,proxy,updater ]
  [ "$(env_get "${env}" BEMMOLY_PUBLIC_URL)" = https://bemmoly.acme.dev ]
  [ "$(env_get "${env}" BEMMOLY_MODULES)" = work ]
  [ "$(env_get "${env}" PG_SHARED_BUFFERS)" = 512MB ]
  [ "$(env_get "${env}" BEMMOLY_UPDATER_URL)" = http://updater:8090 ]
  [ "$(printf '%s' "$(env_get "${env}" BEMMOLY_SECRET_KEY)" | base64 -d | wc -c | tr -d ' ')" = 32 ]
  [ "${#TPL_UPDATER_TOKEN}" -eq 64 ]
  metrics=$(env_get "${env}" BEMMOLY_METRICS_TOKEN)
  [ "${#metrics}" -eq 64 ]
  password=$(env_get "${env}" POSTGRES_PASSWORD)
  [ "$(env_get "${env}" DATABASE_URL)" = "postgres://bemmoly:${password}@db:5432/bemmoly_db" ]
}

# HTTPS answers only with -k (a self-signed certificate); each curl and sleep is logged.
fake_self_signed_https() {
  CALLS="${BATS_TEST_TMPDIR}/calls"
  : >"${CALLS}"
  curl() {
    printf 'curl %s\n' "$*" >>"${CALLS}"
    case " $* " in *" -k "*) return 0 ;; *) return 7 ;; esac
  }
  sleep() { printf 'sleep\n' >>"${CALLS}"; }
}

@test "an internal name takes its self-signed certificate without the ACME wait" {
  fake_self_signed_https
  DOMAIN=bemmoly.test NO_PROXY='' TLS_MODE=internal
  request_certificate >"${BATS_TEST_TMPDIR}/out"
  [ "$(cat "${BATS_TEST_TMPDIR}/out")" = "→ Issuing a self-signed certificate for bemmoly.test … done" ]
  [ "${SELF_SIGNED}" = 1 ]
  [ "$(cat "${CALLS}")" = "curl -fsS -k --max-time 5 --resolve bemmoly.test:443:127.0.0.1 https://bemmoly.test/healthz" ]
}

@test "an auto name polls for a trusted certificate before falling back to self-signed" {
  fake_self_signed_https
  DOMAIN=bemmoly.acme.dev NO_PROXY='' TLS_MODE=auto
  request_certificate >"${BATS_TEST_TMPDIR}/out"
  [ "$(cat "${BATS_TEST_TMPDIR}/out")" = "→ Requesting certificate for bemmoly.acme.dev … self-signed for now" ]
  [ "${SELF_SIGNED}" = 1 ]
  [ "$(grep -c '^sleep$' "${CALLS}")" = 30 ]
  [ "$(grep -c -- ' -k ' "${CALLS}")" = 1 ]
}

@test "images from a bundle are started, not pulled" {
  quietly() { :; }
  has_profile() { return 1; }
  wait_healthy() { return 0; }
  IMAGE_ARCHIVE="${BATS_TEST_TMPDIR}/bemmoly-airgap.tar" VERSION=1.2.0
  run start_stack
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"→ Starting bemmoly:1.2.0 … done"* ]]
  [[ "${output}" != *Pulling* ]]
  IMAGE_ARCHIVE=''
  run start_stack
  [[ "${output}" == "→ Pulling bemmoly:1.2.0 … done" ]]
}

final_message_for() {
  DOMAIN="$1" SELF_SIGNED=1 INSTALL_DIR="${BATS_TEST_TMPDIR}"
  printf 'BEMMOLY_PUBLIC_URL=https://%s\n' "$1" >"${INSTALL_DIR}/.env"
  curl() { printf '{"initialized":%s,"completedAt":null}' "${INITIALIZED}"; }
  final_message
}

@test "the hand-off says sign in after setup and explains local-only certificates" {
  INITIALIZED=false
  run final_message_for bemmoly.test
  [[ "${output}" == *"Open it to create the first admin."* ]]
  [[ "${output}" == *"bemmoly.test is a local-only name"* ]]
  [[ "${output}" != *"a real one follows by itself"* ]]
  INITIALIZED=true
  run final_message_for bemmoly.acme.dev
  [[ "${output}" == *"Open it to sign in."* ]]
  [[ "${output}" == *"until bemmoly.acme.dev points at this machine; a real one follows by itself."* ]]
}
