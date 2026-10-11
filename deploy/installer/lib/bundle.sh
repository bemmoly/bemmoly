# shellcheck shell=sh
# Release bundles for machines without internet access (bemmoly-airgap-<version>-<arch>):
# open one, check it against its checksums and signature, read its version. Shared by the
# installer (--bundle) and `bemmoly upgrade --bundle`.

# The release workflow signs SHA256SUMS keyless; this is the identity it signs with.
BUNDLE_IDENTITY_REGEXP='^https://github\.com/bemmoly/bemmoly/\.github/workflows/release\.yml@refs/(heads/main|tags/v.+)$'
BUNDLE_OIDC_ISSUER=https://token.actions.githubusercontent.com

# The CLI redefines both to fall back to the cosign inside the installed updater image.
cosign_available() { have cosign; }
run_cosign() { cosign "$@"; }

# A folder is used as it is; a .tar.gz is unpacked under $2 first. Sets BUNDLE_DIR.
bundle_open() {
  if [ -d "$1" ]; then
    BUNDLE_DIR=$(cd "$1" && pwd)
  elif [ -f "$1" ]; then
    mkdir -p "$2"
    step "Unpacking $(basename "$1")"
    tar -xzf "$1" -C "$2" 2>>"${BEMMOLY_LOG}" ||
      die "$1 could not be unpacked" "Copy the bundle again; the file may be cut short. Free disk space: $(free_gb "$2") GB."
    step_done
    BUNDLE_DIR=$(find "$2" -mindepth 1 -maxdepth 1 -type d -name 'bemmoly-airgap-*' | head -n 1)
  else
    die "Cannot read $1" "Pass the bemmoly-airgap-<version>-<arch>.tar.gz file, or the folder it unpacks to."
  fi
  if [ -z "${BUNDLE_DIR}" ] || [ ! -f "${BUNDLE_DIR}/images.tar" ] || [ ! -f "${BUNDLE_DIR}/SHA256SUMS" ]; then
    die "$1 is not a Bemmoly release bundle" "Use bemmoly-airgap-<version>-<arch>.tar.gz from https://github.com/bemmoly/bemmoly/releases."
  fi
}

# The version from the bundle's VERSION file, or from its folder name for older bundles.
bundle_version() {
  if [ -f "${BUNDLE_DIR}/VERSION" ]; then
    sed -n 1p "${BUNDLE_DIR}/VERSION"
  else
    basename "${BUNDLE_DIR}" | sed -n 's/^bemmoly-airgap-\(.*\)-[a-z0-9]*$/\1/p'
  fi
}

bundle_arch() {
  basename "${BUNDLE_DIR}" | sed -n 's/^bemmoly-airgap-.*-\([a-z0-9]*\)$/\1/p'
}

machine_arch() {
  case "$(uname -m)" in
    x86_64 | amd64) echo amd64 ;;
    aarch64 | arm64) echo arm64 ;;
    *) uname -m ;;
  esac
}

bundle_check_arch() {
  _bundle_arch=$(bundle_arch)
  [ -z "${_bundle_arch}" ] || [ "${_bundle_arch}" = "$(machine_arch)" ] ||
    die "This bundle is for ${_bundle_arch}; this machine is $(machine_arch)" \
      "Use bemmoly-airgap-$(bundle_version)-$(machine_arch).tar.gz from the same release."
}

# Every file against SHA256SUMS, then the signature over SHA256SUMS.
bundle_verify() {
  step "Checking the bundle against its checksums"
  (cd "${BUNDLE_DIR}" && sha256sum -c --quiet SHA256SUMS) >>"${BEMMOLY_LOG}" 2>&1 ||
    die "The bundle does not match its checksums" "Copy it again from the release; a file was changed or cut short."
  step_done
  bundle_verify_signature
}

bundle_verify_signature() {
  _bundle_sig="${BUNDLE_DIR}/SHA256SUMS.sigstore.json"
  if [ -n "${BUNDLE_SKIP_SIGNATURE:-}" ]; then
    warn "Not checking the bundle's signature (--skip-signature-check)."
    return 0
  fi
  if [ ! -f "${_bundle_sig}" ]; then
    warn "This bundle carries no signature (releases before 0.12 are unsigned); its checksums match."
    return 0
  fi
  if ! cosign_available; then
    warn "cosign is not installed here, so the bundle's signature was not checked. On a machine with cosign:"
    warn "  cosign verify-blob --bundle SHA256SUMS.sigstore.json --certificate-identity-regexp '${BUNDLE_IDENTITY_REGEXP}' --certificate-oidc-issuer ${BUNDLE_OIDC_ISSUER} SHA256SUMS"
    return 0
  fi
  step "Checking the bundle's signature"
  set -- verify-blob --bundle "${_bundle_sig}" \
    --certificate-identity-regexp "${BUNDLE_IDENTITY_REGEXP}" --certificate-oidc-issuer "${BUNDLE_OIDC_ISSUER}"
  if [ -n "${BUNDLE_TRUSTED_ROOT:-}" ]; then set -- "$@" --trusted-root "${BUNDLE_TRUSTED_ROOT}"; fi
  quietly run_cosign "$@" "${BUNDLE_DIR}/SHA256SUMS" ||
    die "The bundle's signature does not verify" \
      "Use a bundle from https://github.com/bemmoly/bemmoly/releases. Without internet, pass --trusted-root with Sigstore's trusted_root.json, or verify on a connected machine and pass --skip-signature-check."
  step_done verified
}

# The installer's --bundle (or a bundle beside install.sh): verified, then installed offline.
prepare_bundle() {
  if [ -z "${BUNDLE}" ] && [ -z "${IMAGE_ARCHIVE}" ] && [ -f "$1/images.tar" ] && [ -f "$1/SHA256SUMS" ]; then
    BUNDLE="$1"
    note "Installing offline from the bundle in ${BUNDLE}"
  fi
  [ -n "${BUNDLE}" ] || return 0
  BUNDLE_WORK="${TMPDIR:-/var/tmp}/bemmoly-bundle.$$"
  bundle_open "${BUNDLE}" "${BUNDLE_WORK}"
  bundle_check_arch
  bundle_verify
  _bundle_version=$(bundle_version)
  semver_ok "${_bundle_version}" || die "The bundle does not say which version it is" "Use an unmodified bemmoly-airgap bundle."
  if [ -n "${VERSION}" ] && [ "${VERSION}" != "${_bundle_version}" ]; then
    die "--version ${VERSION} does not match the bundle (${_bundle_version})" "Leave out --version; the bundle decides it."
  fi
  VERSION="${_bundle_version}"
  IMAGE_ARCHIVE="${BUNDLE_DIR}/images.tar"
}
