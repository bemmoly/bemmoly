#!/usr/bin/env bats
# bemmoly domain set: the URL, Caddy's domain and TLS mode change together, and come back on failure.

setup() {
  DEPLOY_DIR="$(cd "${BATS_TEST_DIRNAME}/../.." && pwd)"
  # shellcheck source=/dev/null
  . "${DEPLOY_DIR}/installer/lib/common.sh"
  # shellcheck source=/dev/null
  . "${DEPLOY_DIR}/cli/lib/stack.sh"
  BEMMOLY_DIR="${BATS_TEST_TMPDIR}/bemmoly"
  BEMMOLY_LOG="${BATS_TEST_TMPDIR}/log"
  mkdir -p "${BEMMOLY_DIR}/data/updater"
  printf '%s\n' COMPOSE_PROFILES=db,proxy,updater BEMMOLY_PUBLIC_URL=https://old.example.com \
    BEMMOLY_DOMAIN=old.example.com BEMMOLY_TLS_MODE=auto >"${BEMMOLY_DIR}/.env"
  COMPOSE_CALLS="${BATS_TEST_TMPDIR}/compose"
  : >"${COMPOSE_CALLS}"
  compose() { printf '%s\n' "$*" >>"${COMPOSE_CALLS}"; }
  domain_tls_mode() { echo auto; }
  app_healthy_within() { return 0; }
}

value() { env_get "${BEMMOLY_DIR}/.env" "$1"; }

@test "with no arguments it prints the URL" {
  run cmd_domain
  [ "${status}" -eq 0 ]
  [ "${output}" = 'URL: https://old.example.com' ]
}

@test "set changes the URL, domain and TLS mode and restarts once" {
  run cmd_domain set new.example.com --yes
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"Everyone signs in again"* && "${output}" == *"running at https://new.example.com"* ]]
  [ "$(value BEMMOLY_PUBLIC_URL)" = https://new.example.com ]
  [ "$(value BEMMOLY_DOMAIN)" = new.example.com ]
  [ "$(cat "${COMPOSE_CALLS}")" = 'up -d' ]
}

@test "a name that does not point here yet is set with the self-signed fallback" {
  domain_tls_mode() { echo internal; }
  run cmd_domain set new.example.com --yes
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"does not point at this machine yet"* ]]
  [ "$(value BEMMOLY_TLS_MODE)" = internal ]
}

@test "without the proxy the URL is plain http on 8080" {
  env_set "${BEMMOLY_DIR}/.env" COMPOSE_PROFILES db,updater
  run cmd_domain set 10.0.0.5 --yes
  [ "${status}" -eq 0 ]
  [ "$(value BEMMOLY_PUBLIC_URL)" = http://10.0.0.5:8080 ]
  [ "$(value BEMMOLY_DOMAIN)" = old.example.com ]
}

@test "an unhealthy app puts the previous values back" {
  app_healthy_within() { return 1; }
  run cmd_domain set new.example.com --yes
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"previous address https://old.example.com is restored"* ]]
  [ "$(value BEMMOLY_PUBLIC_URL)" = https://old.example.com ]
  [ "$(value BEMMOLY_DOMAIN)" = old.example.com ]
  [ "$(wc -l <"${COMPOSE_CALLS}" | tr -d ' ')" = 2 ]
}

@test "a URL or path instead of a name is refused before anything changes" {
  for bad in https://new.example.com new.example.com/app 'new example'; do
    run cmd_domain set "${bad}" --yes
    [ "${status}" -eq 1 ]
    [[ "${output}" == *"Pass the name only"* ]]
  done
  [ ! -s "${COMPOSE_CALLS}" ]
}

@test "config set sends the URL and domain to domain set" {
  run cmd_config set BEMMOLY_PUBLIC_URL https://x.example.com
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"bemmoly domain set"* ]]
  [ "$(value BEMMOLY_PUBLIC_URL)" = https://old.example.com ]
}

@test "it refuses during an update" {
  printf '1 2026-10-08T00:00:00Z\n' >"${BEMMOLY_DIR}/data/updater/lock"
  run cmd_domain set new.example.com --yes
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"An update or rollback is in progress"* ]]
}
