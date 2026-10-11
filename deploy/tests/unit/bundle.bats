#!/usr/bin/env bats
# Release bundles: the installer's --bundle and the checks it shares with bemmoly upgrade.

setup() {
  DEPLOY_DIR="$(cd "${BATS_TEST_DIRNAME}/../.." && pwd)"
  for lib in common args preflight bundle config; do
    # shellcheck source=/dev/null
    . "${DEPLOY_DIR}/installer/lib/${lib}.sh"
  done
  BEMMOLY_LOG="${BATS_TEST_TMPDIR}/log"
  : >"${BEMMOLY_LOG}"
  ARCH=$(machine_arch)
  BUNDLE_NAME="bemmoly-airgap-1.4.0-${ARCH}"
  SRC="${BATS_TEST_TMPDIR}/src/${BUNDLE_NAME}"
  mkdir -p "${SRC}/cli"
  printf 'images\n' >"${SRC}/images.tar"
  printf 'compose\n' >"${SRC}/docker-compose.yml"
  printf 'cli\n' >"${SRC}/cli/bemmoly"
  printf '1.4.0\n' >"${SRC}/VERSION"
  (cd "${SRC}" && sha256sum images.tar docker-compose.yml cli/bemmoly VERSION >SHA256SUMS)
  tar -czf "${BATS_TEST_TMPDIR}/${BUNDLE_NAME}.tar.gz" -C "${BATS_TEST_TMPDIR}/src" "${BUNDLE_NAME}"
  BIN="${BATS_TEST_TMPDIR}/bin"
  mkdir -p "${BIN}"
}

fake_cosign() {
  printf '#!/bin/sh\necho "$@" >"%s/cosign-args"\nexit %s\n' "${BATS_TEST_TMPDIR}" "$1" >"${BIN}/cosign"
  chmod +x "${BIN}/cosign"
  PATH="${BIN}:${PATH}"
}

@test "--bundle, --trusted-root and --skip-signature-check are parsed and checked" {
  parse_args --bundle "${SRC}" --trusted-root "${SRC}/VERSION" --skip-signature-check
  [ "${BUNDLE}" = "${SRC}" ]
  [ "${BUNDLE_TRUSTED_ROOT}" = "${SRC}/VERSION" ]
  [ "${BUNDLE_SKIP_SIGNATURE}" = 1 ]
  run parse_args --bundle "${SRC}" --image-archive "${SRC}/images.tar"
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"do not go together"* ]]
  run parse_args --bundle /nowhere/bundle.tar.gz
  [[ "${output}" == *"Cannot read /nowhere/bundle.tar.gz"* ]]
}

@test "a folder or a .tar.gz opens; its version and architecture are read" {
  bundle_open "${SRC}" "${BATS_TEST_TMPDIR}/work"
  [ "${BUNDLE_DIR}" = "${SRC}" ]
  [ "$(bundle_version)" = 1.4.0 ]
  bundle_open "${BATS_TEST_TMPDIR}/${BUNDLE_NAME}.tar.gz" "${BATS_TEST_TMPDIR}/work" >/dev/null
  [ "${BUNDLE_DIR}" = "${BATS_TEST_TMPDIR}/work/${BUNDLE_NAME}" ]
  [ "$(bundle_arch)" = "${ARCH}" ]
  bundle_check_arch
  rm "${BUNDLE_DIR}/VERSION"
  [ "$(bundle_version)" = 1.4.0 ]
}

@test "anything else is not a bundle, and another architecture's bundle is refused" {
  mkdir -p "${BATS_TEST_TMPDIR}/empty"
  run bundle_open "${BATS_TEST_TMPDIR}/empty" "${BATS_TEST_TMPDIR}/work"
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"is not a Bemmoly release bundle"* ]]
  other="${BATS_TEST_TMPDIR}/bemmoly-airgap-1.4.0-riscv64"
  cp -R "${SRC}" "${other}"
  bundle_open "${other}" "${BATS_TEST_TMPDIR}/work"
  run bundle_check_arch
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"This bundle is for riscv64"* && "${output}" == *"Fix:"* ]]
}

@test "a changed file fails the checksums" {
  bundle_open "${SRC}" "${BATS_TEST_TMPDIR}/work"
  run bundle_verify
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"carries no signature"* ]]
  printf 'changed\n' >>"${SRC}/cli/bemmoly"
  run bundle_verify
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"does not match its checksums"* ]]
}

@test "the signature is checked with cosign when it is installed" {
  printf '{}' >"${SRC}/SHA256SUMS.sigstore.json"
  bundle_open "${SRC}" "${BATS_TEST_TMPDIR}/work"
  cosign_available() { return 1; }
  run bundle_verify_signature
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"signature was not checked"* && "${output}" == *"cosign verify-blob"* ]]
  cosign_available() { have cosign; }
  fake_cosign 0
  BUNDLE_TRUSTED_ROOT=/roots/trusted_root.json
  run bundle_verify_signature
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"signature … verified"* ]]
  args=$(cat "${BATS_TEST_TMPDIR}/cosign-args")
  [[ "${args}" == "verify-blob --bundle ${SRC}/SHA256SUMS.sigstore.json"* ]]
  [[ "${args}" == *"release\\.yml@refs/"* && "${args}" == *"--trusted-root /roots/trusted_root.json ${SRC}/SHA256SUMS" ]]
  fake_cosign 1
  run bundle_verify_signature
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"signature does not verify"* && "${output}" == *"--skip-signature-check"* ]]
  BUNDLE_SKIP_SIGNATURE=1
  run bundle_verify_signature
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"Not checking"* ]]
}

@test "the installer takes the version and the images from the bundle" {
  parse_args --bundle "${BATS_TEST_TMPDIR}/${BUNDLE_NAME}.tar.gz"
  TMPDIR="${BATS_TEST_TMPDIR}"
  prepare_bundle '' >/dev/null 2>&1
  [ "${VERSION}" = 1.4.0 ]
  [ "${IMAGE_ARCHIVE}" = "${BUNDLE_WORK}/${BUNDLE_NAME}/images.tar" ]
  parse_args --bundle "${SRC}" --version 1.3.0
  run prepare_bundle ''
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"--version 1.3.0 does not match the bundle (1.4.0)"* ]]
}

@test "install.sh beside a bundle installs from it without --bundle" {
  parse_args
  run prepare_bundle "${SRC}"
  [[ "${output}" == *"Installing offline from the bundle in ${SRC}"* ]]
  prepare_bundle "${SRC}" >/dev/null 2>&1
  [ "${IMAGE_ARCHIVE}" = "${SRC}/images.tar" ]
  parse_args
  prepare_bundle "${BATS_TEST_TMPDIR}"
  [ -z "${IMAGE_ARCHIVE}" ]
}

@test "an install from a bundle tells the updater to use loaded images" {
  as_root() { "$@"; }
  asset() { cat "${DEPLOY_DIR}/compose/$1"; }
  root_write() { cat >"$1"; }
  parse_args --domain bemmoly.internal --dir "${BATS_TEST_TMPDIR}/install"
  TLS_MODE=internal PG_SHARED_BUFFERS=128MB PG_EFFECTIVE_CACHE_SIZE=384MB
  mkdir -p "${INSTALL_DIR}"
  IMAGE_ARCHIVE="${SRC}/images.tar"
  new_env_file
  [ "$(env_get "${INSTALL_DIR}/.env" BEMMOLY_UPDATER_LOCAL_IMAGES)" = true ]
  IMAGE_ARCHIVE=''
  new_env_file
  [ "$(env_get "${INSTALL_DIR}/.env" BEMMOLY_UPDATER_LOCAL_IMAGES)" = false ]
}
