#!/usr/bin/env bats
# install.sh --refresh-cli: only the bemmoly command changes, never the app (ADR 0024).

setup() {
  DEPLOY_DIR="$(cd "${BATS_TEST_DIRNAME}/../.." && pwd)"
  for lib in common args preflight config start; do
    # shellcheck source=/dev/null
    . "${DEPLOY_DIR}/installer/lib/${lib}.sh"
  done
  as_root() { "$@"; }
  BEMMOLY_LOG="${BATS_TEST_TMPDIR}/log"
  CALLS="${BATS_TEST_TMPDIR}/calls"
  : >"${CALLS}"
  install_cli() { printf 'install_cli %s\n' "$(cli_release)" >>"${CALLS}"; }
  docker() { printf 'docker %s\n' "$*" >>"${CALLS}"; }
  INSTALL_DIR="${BATS_TEST_TMPDIR}/bemmoly"
  mkdir -p "${INSTALL_DIR}"
  printf 'VERSION=0.11.0\nUPDATER_VERSION=0.11.0\n' >"${INSTALL_DIR}/.env"
  cp "${INSTALL_DIR}/.env" "${BATS_TEST_TMPDIR}/env.before"
}

@test "--refresh-cli is a flag of its own" {
  parse_args --refresh-cli --dir "${INSTALL_DIR}" --yes
  [ "${REFRESH_CLI}" = 1 ]
  parse_args
  [ -z "${REFRESH_CLI}" ]
}

@test "--refresh-cli refuses install options, which would change the app" {
  for option in '--domain bemmoly.acme.dev' '--no-proxy' '--no-in-app-updates' '--modules work' \
    '--database-url postgres://u:p@db/bemmoly_db'; do
    # shellcheck disable=SC2086 # one flag and its value
    run parse_args --refresh-cli ${option}
    [ "${status}" -eq 1 ]
    [[ "${output}" == *"--refresh-cli only replaces the bemmoly command"* && "${output}" == *"Fix:"* ]]
  done
}

@test "refresh installs this release's command and leaves the app, its .env and Docker alone" {
  BEMMOLY_DEFAULT_VERSION=0.12.0
  VERSION=''
  run refresh_cli
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"The bemmoly command is 0.12.0; Bemmoly itself stays on 0.11.0"* ]]
  [ "$(cat "${CALLS}")" = 'install_cli 0.12.0' ]
  cmp "${INSTALL_DIR}/.env" "${BATS_TEST_TMPDIR}/env.before"
}

@test "refresh needs an install, and the release the installer carries" {
  BEMMOLY_DEFAULT_VERSION=0.12.0
  INSTALL_DIR="${BATS_TEST_TMPDIR}/nothing-here"
  run refresh_cli
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"No Bemmoly install in ${INSTALL_DIR}"* ]]
  INSTALL_DIR="${BATS_TEST_TMPDIR}/bemmoly"
  VERSION=0.13.0
  run refresh_cli
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"carries the bemmoly command of 0.12.0, not 0.13.0"* ]]
  [ ! -s "${CALLS}" ]
}

@test "the command knows its release: the bundle's version, or dev from a checkout" {
  BEMMOLY_DEFAULT_VERSION=0.12.0
  [ "$(cli_release)" = 0.12.0 ]
  BEMMOLY_DEFAULT_VERSION=''
  [ "$(cli_release)" = dev ]
}

@test "the bundled installer refreshes from its own copy, with the release's VERSION" {
  bundle="${BATS_TEST_TMPDIR}/install.sh"
  sh "${DEPLOY_DIR}/scripts/bundle-installer.sh" --version 0.12.0 >"${bundle}"
  run sh "${bundle}" --help
  [[ "${output}" == *"--refresh-cli"* ]]
  extracted="${BATS_TEST_TMPDIR}/selfupdate.sh"
  sed -n "/^    cli-selfupdate.sh)$/,/^BEMMOLY_ASSET_END$/p" "${bundle}" | sed '1,2d;$d' >"${extracted}"
  cmp "${extracted}" "${DEPLOY_DIR}/cli/lib/selfupdate.sh"
}

@test "the release's command tarball holds exactly what the installer installs" {
  out="${BATS_TEST_TMPDIR}/out"
  sh "${DEPLOY_DIR}/scripts/release-cli.sh" 0.12.0 "${out}"
  (cd "${out}" && shasum -a 256 -c bemmoly-cli-0.12.0.tar.gz.sha256)
  tar -xzf "${out}/bemmoly-cli-0.12.0.tar.gz" -C "${out}"
  [ "$(cat "${out}/bemmoly-cli/VERSION")" = 0.12.0 ]
  [ -x "${out}/bemmoly-cli/bemmoly" ]
  [ "$(cd "${out}/bemmoly-cli/lib" && ls | tr '\n' ' ')" = \
    'bundle.sh cli-backups.sh cli-offline.sh cli-selfupdate.sh cli-stack.sh cli-updates.sh common.sh preflight.sh ' ]
  run sh "${DEPLOY_DIR}/scripts/release-cli.sh" 'not-a-version' "${out}"
  [ "${status}" -eq 1 ]
}
