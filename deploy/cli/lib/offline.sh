# shellcheck shell=bash
# bemmoly upgrade --bundle: an upgrade from a release bundle, for machines without internet
# access. The bundle is checked (checksums, then the signature), its images are loaded, and
# the updater runs the usual upgrade (backup, swap, migrate, health check, rollback on
# failure) on the loaded images instead of pulling.

# Without cosign on the host, the one inside the installed updater image checks signatures.
cosign_available() {
  have cosign || docker image inspect "$(updater_image)" >/dev/null 2>&1
}

run_cosign() {
  if have cosign; then
    cosign "$@"
    return
  fi
  local mounts=(-v "${BUNDLE_DIR}:${BUNDLE_DIR}:ro")
  [[ -z "${BUNDLE_TRUSTED_ROOT:-}" ]] || mounts+=(-v "${BUNDLE_TRUSTED_ROOT}:${BUNDLE_TRUSTED_ROOT}:ro")
  docker run --rm "${mounts[@]}" -e TUF_ROOT=/tmp/sigstore --entrypoint cosign "$(updater_image)" "$@"
}

upgrade_from_bundle() {
  local file="$1" work="${BEMMOLY_DIR}/.bundle.$$" version current
  [[ -z "${BUNDLE_TRUSTED_ROOT:-}" ]] || BUNDLE_TRUSTED_ROOT=$(readlink -f "${BUNDLE_TRUSTED_ROOT}")
  # shellcheck disable=SC2064 # the folder is fixed now
  trap "rm -rf '${work}'; rm -f '${BEMMOLY_LOG}'" EXIT
  bundle_open "${file}" "${work}"
  bundle_check_arch
  bundle_verify
  version=$(bundle_version)
  semver_ok "${version}" || die "The bundle does not say which version it is" "Use an unmodified bemmoly-airgap bundle."
  current=$(env_value VERSION)
  [[ "${version}" != "${current}" ]] || die "Bemmoly ${current} is already installed" "This bundle holds the same version."
  say "Upgrading Bemmoly ${current} → ${version} from the bundle: load, backup, swap, health check."
  say 'If the new version does not become ready within 3 minutes, the previous one is restored automatically.'
  confirm 'Upgrade now?'
  step "Loading the images of ${version}"
  docker load -i "${BUNDLE_DIR}/images.tar" >>"${BEMMOLY_LOG}" 2>&1 ||
    die "The images could not be loaded" "Check the free disk space (df -h /var/lib/docker), then run the command again."
  step_done
  # The bundle's checksums and signature stand in for the registry signature the updater
  # checks on a pull, and from now on the updater never pulls on this machine.
  env_set "$(env_file)" BEMMOLY_UPDATER_LOCAL_IMAGES true
  UPDATER_ENV_OVERRIDES=(-e BEMMOLY_UPDATER_LOCAL_IMAGES=true -e BEMMOLY_ALLOW_UNSIGNED_UPDATES=true)
  run_updater upgrade "${version}"
  if [[ "$(env_value VERSION)" == "${version}" ]]; then
    [[ "$(env_value UPDATER_VERSION)" == "${version}" ]] || follow_app_version
    success "Bemmoly ${version} is running"
    cli_follow_bundle "${version}"
  fi
}

# The bemmoly command follows the release (ADR 0024), from the bundle's signed copy of it.
# Never fails the upgrade.
cli_follow_bundle() {
  [[ -z "${CLI_FROM_CHECKOUT:-}" ]] && version_older "$(cli_version)" "$1" || return 0
  if (cli_refresh "$1" "${BUNDLE_DIR}") 2>>"${BEMMOLY_LOG}"; then
    success "The bemmoly command moved to $1"
    return 0
  fi
  warn "The bemmoly command stays on $(cli_version); the bundle has no signed copy that checks out"
  say "  Move it with the bundle's installer: sudo sh <bundle folder>/install.sh --refresh-cli"
}
