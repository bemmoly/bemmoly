#!/usr/bin/env bats
# bemmoly upgrade --bundle and bemmoly settings import, with Docker and the app stubbed.

setup() {
  DEPLOY_DIR="$(cd "${BATS_TEST_DIRNAME}/../.." && pwd)"
  for lib in common preflight bundle; do
    # shellcheck source=/dev/null
    . "${DEPLOY_DIR}/installer/lib/${lib}.sh"
  done
  for part in stack updates selfupdate offline; do
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
  BUNDLE="${BATS_TEST_TMPDIR}/bemmoly-airgap-1.4.0-$(machine_arch)"
  mkdir -p "${BUNDLE}"
  printf 'images\n' >"${BUNDLE}/images.tar"
  printf '1.4.0\n' >"${BUNDLE}/VERSION"
  (cd "${BUNDLE}" && sha256sum images.tar VERSION >SHA256SUMS)
  compose() { printf 'compose %s\n' "$*" >>"${CALLS}"; }
  docker() { printf 'docker %s\n' "$*" >>"${CALLS}"; }
  cosign_available() { return 1; }
  # The updater moves the app and itself, as one with self-update does.
  run_updater() {
    printf 'updater %s | %s\n' "$*" "${UPDATER_ENV_OVERRIDES[*]}" >>"${CALLS}"
    env_set "${BEMMOLY_DIR}/.env" VERSION "$2"
    env_set "${BEMMOLY_DIR}/.env" UPDATER_VERSION "$2"
  }
}

@test "upgrade --bundle checks the bundle, loads it and upgrades on the loaded images" {
  run cmd_upgrade --bundle "${BUNDLE}" --yes
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"Upgrading Bemmoly 1.3.0 → 1.4.0 from the bundle"* ]]
  [[ "${output}" == *"✓ Bemmoly 1.4.0 is running"* ]]
  grep -qx "docker load -i ${BUNDLE}/images.tar" "${CALLS}"
  grep -qx 'updater upgrade 1.4.0 | -e BEMMOLY_UPDATER_LOCAL_IMAGES=true -e BEMMOLY_ALLOW_UNSIGNED_UPDATES=true' "${CALLS}"
  [ "$(env_get "${BEMMOLY_DIR}/.env" BEMMOLY_UPDATER_LOCAL_IMAGES)" = true ]
  ! grep -q 'compose pull' "${CALLS}"
  # This bundle carries no signed bemmoly command, so the command stays and says how to move.
  [[ "${output}" == *"The bemmoly command stays on"* && "${output}" == *"--refresh-cli"* ]]
}

@test "a bundle that fails its checksums changes nothing" {
  printf 'changed\n' >>"${BUNDLE}/images.tar"
  run cmd_upgrade --bundle "${BUNDLE}" --yes
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"does not match its checksums"* ]]
  [ ! -s "${CALLS}" ]
  [ "$(env_get "${BEMMOLY_DIR}/.env" VERSION)" = 1.3.0 ]
}

@test "the bundle decides the version, and the installed one is refused" {
  run cmd_upgrade 1.4.0 --bundle "${BUNDLE}" --yes
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"Pass a version or --bundle, not both"* ]]
  printf '1.3.0\n' >"${BUNDLE}/VERSION"
  (cd "${BUNDLE}" && sha256sum images.tar VERSION >SHA256SUMS)
  run cmd_upgrade --bundle "${BUNDLE}" --yes
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"Bemmoly 1.3.0 is already installed"* ]]
  run cmd_upgrade --bundle
  [[ "${output}" == *"--bundle needs a value"* ]]
}

@test "without cosign on the host, the installed updater's cosign checks the signature" {
  have() { [ "$1" != cosign ]; }
  docker() { printf 'docker %s\n' "$*" >>"${CALLS}"; }
  . "${DEPLOY_DIR}/cli/lib/offline.sh"
  BUNDLE_DIR="${BUNDLE}"
  cosign_available
  run_cosign verify-blob --bundle x
  grep -q "^docker run --rm -v ${BUNDLE}:${BUNDLE}:ro -e TUF_ROOT=/tmp/sigstore --entrypoint cosign ghcr.io/bemmoly/updater:1.3.0 verify-blob --bundle x$" "${CALLS}"
}

@test "settings import sends the file to the app and needs one" {
  in_app() { printf 'in_app %s\n' "$*" >>"${CALLS}"; cat >>"${CALLS}"; }
  printf '{"email.smtp.host":"smtp.example.com"}' >"${BATS_TEST_TMPDIR}/settings.json"
  run cmd_settings import "${BATS_TEST_TMPDIR}/settings.json"
  [ "${status}" -eq 0 ]
  grep -qx 'in_app bemmoly-system settings-import' "${CALLS}"
  grep -q 'smtp.example.com' "${CALLS}"
  run cmd_settings import
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"Usage: bemmoly settings import FILE"* ]]
}
