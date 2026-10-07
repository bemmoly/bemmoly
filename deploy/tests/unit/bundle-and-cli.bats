#!/usr/bin/env bats
# The bundled installer and the bemmoly CLI's entry points.

setup() {
  DEPLOY_DIR="$(cd "${BATS_TEST_DIRNAME}/../.." && pwd)"
}

@test "the bundle is one valid sh file that carries every asset" {
  bundle="${BATS_TEST_TMPDIR}/install.sh"
  sh "${DEPLOY_DIR}/scripts/bundle-installer.sh" --version 1.2.0 >"${bundle}"
  sh -n "${bundle}"
  grep -q "^BEMMOLY_DEFAULT_VERSION='1.2.0'$" "${bundle}"
  for asset in docker-compose.yml Caddyfile env.template common.sh preflight.sh \
    cli-stack.sh cli-backups.sh cli-updates.sh bemmoly completion.bash \
    bemmoly-backup.service bemmoly-backup.timer; do
    grep -q "^    ${asset})$" "${bundle}"
  done
  run sh "${bundle}" --help
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"curl -fsSL https://get.bemmoly.com | sh"* ]]
}

@test "bundled assets are byte-identical to their sources" {
  bundle="${BATS_TEST_TMPDIR}/install.sh"
  sh "${DEPLOY_DIR}/scripts/bundle-installer.sh" >"${bundle}"
  extracted="${BATS_TEST_TMPDIR}/compose.yml"
  sed -n "/^    docker-compose.yml)$/,/^BEMMOLY_ASSET_END$/p" "${bundle}" | sed '1,2d;$d' >"${extracted}"
  cmp "${extracted}" "${DEPLOY_DIR}/compose/docker-compose.yml"
}

@test "piped into sh, install.sh fetches the matching release's installer" {
  bin="${BATS_TEST_TMPDIR}/bin"
  mkdir -p "${bin}"
  printf '#!/bin/sh\nfor a in "$@"; do last="$a"; done\necho "$last" >>"%s/urls"\nexit 22\n' \
    "${BATS_TEST_TMPDIR}" >"${bin}/curl"
  chmod +x "${bin}/curl"
  run env PATH="${bin}:${PATH}" sh -s -- --version 1.2.0 --yes <"${DEPLOY_DIR}/install.sh"
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"Could not download the installer"* && "${output}" == *"Fix:"* ]]
  grep -qx 'https://github.com/bemmoly/bemmoly/releases/download/v1.2.0/bemmoly-installer.sh' "${BATS_TEST_TMPDIR}/urls"
  run env PATH="${bin}:${PATH}" sh -s -- --yes <"${DEPLOY_DIR}/install.sh"
  grep -qx 'https://github.com/bemmoly/bemmoly/releases/latest/download/bemmoly-installer.sh' "${BATS_TEST_TMPDIR}/urls"
}

@test "the CLI prints its commands without root" {
  run bash "${DEPLOY_DIR}/cli/bemmoly" help
  [ "${status}" -eq 0 ]
  for command in status doctor logs shell backup backups restore upgrade rollback db update-channel; do
    [[ "${output}" == *"${command}"* ]]
  done
}

@test "the install script refuses unknown options with a fix" {
  run sh "${DEPLOY_DIR}/install.sh" --definitely-not-an-option
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"Unknown option"* ]]
  [[ "${output}" == *"Fix: Run with --help"* ]]
}

@test "the Compose file renders with a filled-in .env" {
  if ! docker compose version >/dev/null 2>&1; then skip "docker compose is not installed"; fi
  dir="${BATS_TEST_TMPDIR}/stack"
  mkdir -p "${dir}"
  cp "${DEPLOY_DIR}/compose/docker-compose.yml" "${DEPLOY_DIR}/compose/Caddyfile" "${dir}/"
  cat >"${dir}/.env" <<EOF
VERSION=1.2.0
COMPOSE_PROFILES=db,proxy,updater
BEMMOLY_DIR=${dir}
BEMMOLY_DOMAIN=bemmoly.acme.dev
POSTGRES_PASSWORD=secret
UPDATER_TOKEN=not-a-real-token
PG_SHARED_BUFFERS=512MB
EOF
  run docker compose --project-directory "${dir}" config --services
  [ "${status}" -eq 0 ]
  [[ "${output}" == *bemmoly* && "${output}" == *db* && "${output}" == *proxy* && "${output}" == *updater* ]]
  run docker compose --project-directory "${dir}" config
  [[ "${output}" == *"shared_buffers=512MB"* ]]
  [[ "${output}" != *"8090:"* ]]
  sed -i.bak 's/^COMPOSE_PROFILES=.*/COMPOSE_PROFILES=db/' "${dir}/.env"
  run docker compose --project-directory "${dir}" config --services
  [[ "${output}" != *proxy* && "${output}" != *updater* ]]
}
