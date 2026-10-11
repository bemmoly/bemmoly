#!/usr/bin/env bats
# bemmoly self-update, upgrade and the updater's staged copy keep the command on the app's
# release (ADR 0024). Releases are served from a folder through curl's file://; cosign is a
# stand-in that exits with COSIGN_EXIT, so the signature outcome is the test's to choose.

setup() {
  DEPLOY_DIR="$(cd "${BATS_TEST_DIRNAME}/../.." && pwd)"
  # shellcheck source=/dev/null
  . "${DEPLOY_DIR}/installer/lib/common.sh"
  for part in stack updates selfupdate; do
    # shellcheck source=/dev/null
    . "${DEPLOY_DIR}/cli/lib/${part}.sh"
  done
  BEMMOLY_DIR="${BATS_TEST_TMPDIR}/bemmoly"
  BEMMOLY_LOG="${BATS_TEST_TMPDIR}/log"
  RELEASES="${BATS_TEST_TMPDIR}/releases"
  CALLS="${BATS_TEST_TMPDIR}/calls"
  CLI_BIN_PATH="${BATS_TEST_TMPDIR}/usr/bin/bemmoly"
  CLI_LIB_PATH="${BATS_TEST_TMPDIR}/usr/lib/bemmoly"
  CLI_COMPLETION_PATH="${BATS_TEST_TMPDIR}/usr/completions/bemmoly"
  ASSUME_YES=1
  mkdir -p "${BEMMOLY_DIR}" "${CLI_LIB_PATH}" "$(dirname "${CLI_BIN_PATH}")" "$(dirname "${CLI_COMPLETION_PATH}")"
  : >"${CALLS}"
  printf 'VERSION=1.3.0\nUPDATER_VERSION=1.3.0\nBEMMOLY_RELEASES_URL=file://%s\n' "${RELEASES}" >"${BEMMOLY_DIR}/.env"
  printf '1.2.0\n' >"${CLI_LIB_PATH}/VERSION"
  printf '#!/usr/bin/env bash\necho old\n' >"${CLI_BIN_PATH}"

  stubs="${BATS_TEST_TMPDIR}/stubs"
  mkdir -p "${stubs}"
  printf '#!/bin/sh\necho "cosign $*" >>"%s"\nexit "${COSIGN_EXIT:-0}"\n' "${CALLS}" >"${stubs}/cosign"
  chmod +x "${stubs}/cosign"
  PATH="${stubs}:${PATH}"
  cli_reexec() { printf 'reexec %s\n' "$*" >>"${CALLS}"; }
  make_release 1.3.0
}

# make_release VERSION: the release's assets as the release workflow attaches them.
make_release() {
  local dir="${RELEASES}/v$1"
  mkdir -p "${dir}"
  sh "${DEPLOY_DIR}/scripts/release-cli.sh" "$1" "${dir}" >/dev/null
  write_manifest "$1" "$(cli_sha256 "${dir}/bemmoly-cli-$1.tar.gz")"
  printf '{"mediaType":"application/vnd.dev.sigstore.bundle.v0.3+json"}\n' >"${dir}/release-manifest.json.sigstore.json"
}

write_manifest() {
  cat >"${RELEASES}/v$1/release-manifest.json" <<EOF
{
  "version": "$1",
  "channel": "stable",
  "images": {
    "app": { "ref": "ghcr.io/bemmoly/bemmoly:$1", "digest": null },
    "updater": { "ref": "ghcr.io/bemmoly/updater:$1", "digest": null }
  },
  "cli": {
    "asset": "bemmoly-cli-$1.tar.gz",
    "sha256": "$2"
  },
  "rollback": "code"
}
EOF
}

# stage VERSION: what the updater leaves in BEMMOLY_DIR/cli-update.
stage() {
  local dir="${BEMMOLY_DIR}/cli-update"
  mkdir -p "${dir}"
  chmod 755 "${dir}"
  cp "${RELEASES}/v$1/bemmoly-cli-$1.tar.gz" "${dir}/bemmoly-cli.tar.gz"
  printf '%s  bemmoly-cli.tar.gz\n' "$(cli_sha256 "${dir}/bemmoly-cli.tar.gz")" >"${dir}/bemmoly-cli.tar.gz.sha256"
  printf '%s\n' "$1" >"${dir}/VERSION"
}

installed() { cat "${CLI_LIB_PATH}/VERSION"; }

# `! command` does not fail a bats test; this does.
refute() { if "$@"; then return 1; fi; }

@test "self-update installs the app's release once cosign accepts the signed manifest" {
  run cmd_self_update
  [ "${status}" -eq 0 ]
  [ "$(installed)" = 1.3.0 ]
  for name in common.sh preflight.sh cli-stack.sh cli-backups.sh cli-updates.sh cli-selfupdate.sh; do
    [ -f "${CLI_LIB_PATH}/${name}" ]
  done
  [ -x "${CLI_BIN_PATH}" ] && cmp "${CLI_BIN_PATH}" "${DEPLOY_DIR}/cli/bemmoly"
  cmp "${CLI_COMPLETION_PATH}" "${DEPLOY_DIR}/cli/completion.bash"
  grep -q "^cosign verify-blob --bundle .*release-manifest.json.sigstore.json --certificate-identity-regexp ^https://github" "${CALLS}"
  grep -q -- "--certificate-oidc-issuer https://token.actions.githubusercontent.com .*/release-manifest.json$" "${CALLS}"
  grep -qx 'reexec version' "${CALLS}"
  [ -z "$(find "${CLI_LIB_PATH}" "$(dirname "${CLI_BIN_PATH}")" -name '*.new')" ]
}

@test "a signature cosign rejects changes nothing" {
  export COSIGN_EXIT=1
  run cmd_self_update 1.3.0
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"The signature of release-manifest.json does not verify. The bemmoly command was not changed"* ]]
  [[ "${output}" == *"BEMMOLY_ALLOW_UNSIGNED_UPDATES=true"* ]]
  [ "$(installed)" = 1.2.0 ]
  grep -q '^echo old$' "${CLI_BIN_PATH}"
  refute grep -q reexec "${CALLS}"
}

@test "without cosign the release is refused unless unsigned updates are allowed" {
  have() { [[ "$1" != cosign && "$1" != docker ]] && command -v "$1" >/dev/null 2>&1; }
  run cmd_self_update
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"cosign is not available"* ]]
  [ "$(installed)" = 1.2.0 ]
  printf 'BEMMOLY_ALLOW_UNSIGNED_UPDATES=true\n' >>"${BEMMOLY_DIR}/.env"
  run cmd_self_update
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"continuing because BEMMOLY_ALLOW_UNSIGNED_UPDATES=true"* ]]
  [ "$(installed)" = 1.3.0 ]
}

@test "a tarball that does not match the signed checksum is refused, even when unsigned is allowed" {
  printf 'BEMMOLY_ALLOW_UNSIGNED_UPDATES=true\n' >>"${BEMMOLY_DIR}/.env"
  printf 'tampered' >>"${RELEASES}/v1.3.0/bemmoly-cli-1.3.0.tar.gz"
  run cmd_self_update
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"does not match the checksum in the signed release manifest"* ]]
  [ "$(installed)" = 1.2.0 ]
}

@test "a signed tarball with files outside bemmoly-cli/ is refused" {
  local dir="${RELEASES}/v1.3.0" work="${BATS_TEST_TMPDIR}/evil"
  mkdir -p "${work}"
  tar -xzf "${dir}/bemmoly-cli-1.3.0.tar.gz" -C "${work}"
  printf 'echo pwned\n' >"${work}/evil.sh"
  tar -czf "${dir}/bemmoly-cli-1.3.0.tar.gz" -C "${work}" bemmoly-cli evil.sh
  write_manifest 1.3.0 "$(cli_sha256 "${dir}/bemmoly-cli-1.3.0.tar.gz")"
  run cmd_self_update
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"has files outside bemmoly-cli/"* ]]
  [ "$(installed)" = 1.2.0 ]
}

@test "a release made before self-update points at the installer" {
  sed -i.bak '/"cli"/,/},/d' "${RELEASES}/v1.3.0/release-manifest.json"
  run cmd_self_update
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"does not publish the bemmoly command; it predates self-update"* ]]
  [[ "${output}" == *"sh -s -- --refresh-cli"* ]]
}

@test "COSIGN_PUBLIC_KEY verifies with that key instead of the release identity" {
  printf 'COSIGN_PUBLIC_KEY=/etc/bemmoly/cosign.pub\n' >>"${BEMMOLY_DIR}/.env"
  run cmd_self_update
  [ "${status}" -eq 0 ]
  grep -q -- '--key /etc/bemmoly/cosign.pub' "${CALLS}"
  refute grep -q -- '--certificate-identity-regexp' "${CALLS}"
}

@test "an extracted air-gap bundle folder works without the network" {
  cp -R "${RELEASES}/v1.3.0" "${BATS_TEST_TMPDIR}/bundle"
  rm -rf "${RELEASES}"
  run cmd_self_update --from "${BATS_TEST_TMPDIR}/bundle"
  [ "${status}" -eq 0 ]
  [ "$(installed)" = 1.3.0 ]
  run cmd_self_update 1.4.0 --from "${BATS_TEST_TMPDIR}/bundle"
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"The release manifest is for 1.3.0, not 1.4.0"* ]]
}

@test "upgrade moves the command to the new release and runs it again" {
  printf 'VERSION=1.2.0\nUPDATER_VERSION=1.2.0\nBEMMOLY_RELEASES_URL=file://%s\n' "${RELEASES}" >"${BEMMOLY_DIR}/.env"
  run_updater() {
    env_set "${BEMMOLY_DIR}/.env" VERSION "$2"
    env_set "${BEMMOLY_DIR}/.env" UPDATER_VERSION "$2"
  }
  run cmd_upgrade 1.3.0 --yes
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"The bemmoly command moved 1.2.0 → 1.3.0"* ]]
  [ "$(installed)" = 1.3.0 ]
  grep -qx 'reexec version' "${CALLS}"
}

@test "a command that cannot follow never fails the upgrade" {
  export COSIGN_EXIT=1
  run_updater() { env_set "${BEMMOLY_DIR}/.env" VERSION "$2"; }
  printf 'VERSION=1.2.0\nUPDATER_VERSION=1.3.0\nBEMMOLY_RELEASES_URL=file://%s\n' "${RELEASES}" >"${BEMMOLY_DIR}/.env"
  run cmd_upgrade 1.3.0 --yes
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"Bemmoly 1.3.0 is running, but the bemmoly command stays on 1.2.0"* ]]
  [[ "${output}" == *"sudo bemmoly self-update 1.3.0"* ]]
  [ "$(installed)" = 1.2.0 ]
}

@test "an air-gapped upgrade uses the staged copy, or points at the bundle" {
  printf 'BEMMOLY_UPDATER_LOCAL_IMAGES=true\n' >>"${BEMMOLY_DIR}/.env"
  run cli_follow_release 1.3.0
  [[ "${output}" == *"self-update --from <folder>"* ]]
  [ "$(installed)" = 1.2.0 ]
  stage 1.3.0
  run cli_follow_release 1.3.0
  [ "${status}" -eq 0 ]
  [ "$(installed)" = 1.3.0 ]
}

@test "the copy the updater staged is installed before the next command" {
  stage 1.3.0
  run cli_apply_staged status --json
  [ "${status}" -eq 0 ]
  [ "$(installed)" = 1.3.0 ]
  grep -qx 'reexec status --json' "${CALLS}"
}

@test "a staged copy moves the command only forward, and only to the app's release" {
  stage 1.3.0
  printf 'VERSION=1.2.0\n' >"${BEMMOLY_DIR}/.env"
  cli_apply_staged status
  [ "$(installed)" = 1.2.0 ]
  printf 'VERSION=1.3.0\n' >"${BEMMOLY_DIR}/.env"
  printf '1.4.0\n' >"${CLI_LIB_PATH}/VERSION"
  cli_apply_staged status
  [ "$(installed)" = 1.4.0 ]
  BEMMOLY_CLI_REEXEC=1 cli_apply_staged status
  [ ! -s "${CALLS}" ]
}

@test "a staged copy others can write, or one cut short, is refused" {
  stage 1.3.0
  chmod g+w "${BEMMOLY_DIR}/cli-update"
  run cli_apply_staged status
  [[ "${output}" == *"could not be installed; still running 1.2.0"* ]]
  [ "$(installed)" = 1.2.0 ]
  grep -q 'writable by someone other than root' "${BEMMOLY_LOG}"
  chmod g-w "${BEMMOLY_DIR}/cli-update"
  printf 'x' >>"${BEMMOLY_DIR}/cli-update/bemmoly-cli.tar.gz"
  run cli_apply_staged status
  [ "$(installed)" = 1.2.0 ]
  grep -q 'does not match its checksum' "${BEMMOLY_LOG}"
}

@test "release order: patches, minors, pre-releases, and versions that are not releases" {
  version_older 1.2.0 1.3.0
  version_older 1.2.9 1.10.0
  version_older 1.3.0-beta.2 1.3.0
  version_older 1.3.0-beta.9 1.3.0-beta.10
  version_older unknown 0.1.0
  refute version_older 1.3.0 1.3.0
  refute version_older 1.10.0 1.9.0
  refute version_older 1.3.0 1.3.0-beta.1
  refute version_older 1.3.0 unknown
}

@test "version names the three releases and says when the command lags" {
  run cmd_version
  [[ "${output}" == *"bemmoly command  1.2.0"* && "${output}" == *"app              1.3.0"* ]]
  [[ "${output}" == *"Run: sudo bemmoly self-update"* ]]
}
