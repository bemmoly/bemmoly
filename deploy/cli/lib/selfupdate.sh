# shellcheck shell=bash
# bemmoly self-update and version: the bemmoly command follows the release it manages
# (ADR 0024). Three sources, one install step:
#   - the GitHub release: bemmoly-cli-<version>.tar.gz, whose SHA-256 is listed in
#     release-manifest.json, whose cosign signature is checked first;
#   - the copy the updater left in BEMMOLY_DIR/cli-update after an in-app update, from
#     its own verified image; any command run as root installs it first;
#   - an extracted air-gap bundle folder (self-update --from), checked like a download.

: "${CLI_BIN_PATH:=/usr/local/bin/bemmoly}"
: "${CLI_LIB_PATH:=/usr/local/lib/bemmoly}"
: "${CLI_COMPLETION_PATH:=/usr/share/bash-completion/completions/bemmoly}"
CLI_RELEASES_URL=https://github.com/bemmoly/bemmoly/releases/download
CLI_IDENTITY_REGEXP='^https://github\.com/bemmoly/bemmoly/\.github/workflows/release\.yml@refs/(heads/main|tags/v.+)$'
CLI_OIDC_ISSUER=https://token.actions.githubusercontent.com
CLI_MANIFEST=release-manifest.json

cli_version() {
  if [[ -n "${CLI_FROM_CHECKOUT:-}" ]]; then printf checkout && return; fi
  local version
  version=$(cat "${CLI_LIB_PATH}/VERSION" 2>/dev/null || true)
  printf '%s' "${version:-unknown}"
}

# version_older A B: true when release A comes before release B. A version that is not
# a release (unknown, dev) comes before every release.
version_older() {
  semver_ok "$2" || return 1
  semver_ok "$1" || return 0
  local a b i x y
  IFS=. read -r -a a <<<"${1%%-*}"
  IFS=. read -r -a b <<<"${2%%-*}"
  for i in 0 1 2; do
    ((10#${a[i]} < 10#${b[i]})) && return 0
    ((10#${a[i]} > 10#${b[i]})) && return 1
  done
  [[ "$1" == "$2" ]] && return 1
  # Same X.Y.Z: a pre-release comes first, then pre-releases by their last number.
  [[ "$1" != *-* ]] && return 1
  [[ "$2" != *-* ]] && return 0
  x="${1##*[^0-9]}"
  y="${2##*[^0-9]}"
  ((10#${x:-0} < 10#${y:-0}))
}

cli_sha256() {
  if have sha256sum; then sha256sum "$1"; else shasum -a 256 "$1"; fi | awk '{ print $1 }'
}

# The command replaces itself and runs again; the new copy does not look for updates.
cli_reexec() {
  rm -f "${BEMMOLY_LOG}"
  exec env BEMMOLY_CLI_REEXEC=1 "${CLI_BIN_PATH}" "$@"
}

# cli_signature_problem DIR: nothing when cosign accepts DIR/release-manifest.json as signed
# by the release workflow (or by COSIGN_PUBLIC_KEY); otherwise why not. cosign comes from
# the host, else from the installed updater image, which carries it.
cli_signature_problem() {
  local dir="$1" key args mounts
  key=$(env_value COSIGN_PUBLIC_KEY || true)
  args=(verify-blob --bundle "${dir}/${CLI_MANIFEST}.sigstore.json")
  if [[ -n "${key}" ]]; then
    args+=(--key "${key}")
  else
    args+=(--certificate-identity-regexp "${CLI_IDENTITY_REGEXP}" --certificate-oidc-issuer "${CLI_OIDC_ISSUER}")
  fi
  args+=("${dir}/${CLI_MANIFEST}")
  printf '\n$ cosign %s\n' "${args[*]}" >>"${BEMMOLY_LOG}"
  if have cosign; then
    cosign "${args[@]}" >>"${BEMMOLY_LOG}" 2>&1 && return 0
  elif have docker && docker image inspect "$(updater_image)" >/dev/null 2>&1; then
    mounts=(-v "${dir}:${dir}:ro")
    [[ -z "${key}" ]] || mounts+=(-v "${key}:${key}:ro")
    docker run --rm "${mounts[@]}" "$(updater_image)" cosign "${args[@]}" >>"${BEMMOLY_LOG}" 2>&1 && return 0
  else
    printf 'cosign is not available to check the signature of %s' "${CLI_MANIFEST}"
    return 0
  fi
  printf 'The signature of %s does not verify' "${CLI_MANIFEST}"
}

# The same rule as images (ADR 0020): unsigned is refused unless the admin accepts it.
cli_require_signature() {
  local problem
  problem=$(cli_signature_problem "$1")
  [[ -n "${problem}" ]] || return 0
  if [[ "$(env_value BEMMOLY_ALLOW_UNSIGNED_UPDATES)" == true ]]; then
    warn "${problem}; continuing because BEMMOLY_ALLOW_UNSIGNED_UPDATES=true"
    return 0
  fi
  die "${problem}. The bemmoly command was not changed" \
    "Download it again; to accept an unsigned release, set BEMMOLY_ALLOW_UNSIGNED_UPDATES=true in ${BEMMOLY_DIR}/.env."
}

# cli_manifest_entry DIR: "asset sha256 version" for the CLI the signed manifest lists.
cli_manifest_entry() {
  local flat cli asset sha version
  flat=$(tr -d ' \n\r\t' <"$1/${CLI_MANIFEST}")
  cli=$(sed -n 's/.*"cli":{\([^}]*\)}.*/\1/p' <<<"${flat}")
  asset=$(sed -n 's/.*"asset":"\(bemmoly-cli-[0-9A-Za-z.-]*\.tar\.gz\)".*/\1/p' <<<"${cli}")
  sha=$(sed -n 's/.*"sha256":"\([0-9a-f]\{64\}\)".*/\1/p' <<<"${cli}")
  version="${asset#bemmoly-cli-}"
  version="${version%.tar.gz}"
  [[ -n "${asset}" && -n "${sha}" && "${flat}" == *"\"version\":\"${version}\""* ]] || return 1
  printf '%s %s %s' "${asset}" "${sha}" "${version}"
}

# cli_unpack_install TARBALL VERSION: a complete bemmoly-cli folder for VERSION, installed.
cli_unpack_install() {
  local tarball="$1" into
  into="$(dirname "${tarball}")/unpacked"
  mkdir -p "${into}"
  if tar -tzf "${tarball}" | grep -Ev '^bemmoly-cli(/[A-Za-z0-9_][A-Za-z0-9._-]*)*/?$' | grep -q .; then
    die "$(basename "${tarball}") has files outside bemmoly-cli/" "Download it again; if it repeats, report it."
  fi
  tar -xzf "${tarball}" -C "${into}" || die "$(basename "${tarball}") could not be unpacked" "Download it again."
  cli_check_tree "${into}/bemmoly-cli" "$2" ||
    die "$(basename "${tarball}") is not a complete bemmoly command for $2" "Download it again; if it repeats, report it."
  cli_install_tree "${into}/bemmoly-cli" ||
    die "Could not write the bemmoly command to ${CLI_LIB_PATH} and ${CLI_BIN_PATH}" \
      "Check free space and that /usr/local is writable, then: sudo bemmoly self-update"
}

cli_check_tree() {
  local dir="$1" file
  [[ "$(cat "${dir}/VERSION" 2>/dev/null)" == "$2" && -f "${dir}/lib/common.sh" ]] || return 1
  for file in "${dir}/bemmoly" "${dir}/completion.bash" "${dir}"/lib/*.sh; do
    if [[ ! -f "${file}" ]] || ! bash -n "${file}" 2>>"${BEMMOLY_LOG}"; then return 1; fi
  done
}

# cli_place SOURCE MODE TARGET: written beside TARGET, then renamed over it, so a bemmoly
# that is running keeps reading the file it opened.
cli_place() { install -m "$2" "$1" "$3.new" && mv -f "$3.new" "$3"; }

# Checked step by step: callers may run it where `set -e` does not apply. VERSION goes
# last, so an install cut short is tried again.
cli_install_tree() {
  local dir="$1" file folder
  for folder in "${CLI_LIB_PATH}" "$(dirname "${CLI_BIN_PATH}")"; do
    [[ -d "${folder}" ]] || install -d -m 755 "${folder}" || return 1
  done
  for file in "${dir}"/lib/*.sh; do
    cli_place "${file}" 644 "${CLI_LIB_PATH}/$(basename "${file}")" || return 1
  done
  cli_place "${dir}/bemmoly" 755 "${CLI_BIN_PATH}" || return 1
  if [[ -d "$(dirname "${CLI_COMPLETION_PATH}")" ]]; then
    cli_place "${dir}/completion.bash" 644 "${CLI_COMPLETION_PATH}" || return 1
  fi
  cli_place "${dir}/VERSION" 644 "${CLI_LIB_PATH}/VERSION"
}

cli_fetch() {
  printf '\n$ curl %s\n' "$1" >>"${BEMMOLY_LOG}"
  curl -fsSL --connect-timeout 15 --max-time 300 -o "$2" "$1" 2>>"${BEMMOLY_LOG}"
}

# cli_refresh VERSION [FOLDER]: the release's bemmoly command from GitHub (or from an
# extracted bundle FOLDER), verified and installed. Runs in a subshell: a failure exits it.
cli_refresh() (
  local version="$1" from="${2:-}" work base entry asset sha name
  work=$(mktemp -d "${TMPDIR:-/tmp}/bemmoly-cli.XXXXXX")
  trap 'rm -rf "${work}"' EXIT
  base="$(env_value BEMMOLY_RELEASES_URL || true)"
  base="${base:-${CLI_RELEASES_URL}}/v${version}"
  for name in "${CLI_MANIFEST}" "${CLI_MANIFEST}.sigstore.json"; do
    if [[ -n "${from}" ]]; then
      cp "${from}/${name}" "${work}/" 2>/dev/null ||
        die "${from} has no ${name}" "Pass the folder of an extracted bemmoly-airgap bundle that carries the bemmoly command."
    else
      cli_fetch "${base}/${name}" "${work}/${name}" ||
        die "Could not download ${name} for ${version}" \
          "Check the version exists and outbound HTTPS to github.com, or use a bundle: sudo bemmoly self-update --from <folder>"
    fi
  done
  cli_require_signature "${work}"
  entry=$(cli_manifest_entry "${work}") ||
    die "Bemmoly ${version:-in ${from}} does not publish the bemmoly command; it predates self-update" \
      "Refresh it with the installer instead: curl -fsSL https://get.bemmoly.com | sh -s -- --refresh-cli"
  read -r asset sha name <<<"${entry}"
  [[ -z "${version}" || "${name}" == "${version}" ]] ||
    die "The release manifest is for ${name}, not ${version}" "Pass the version the bundle is for, or none."
  if [[ -n "${from}" ]]; then
    cp "${from}/${asset}" "${work}/" 2>/dev/null || die "${from} has no ${asset}" "Copy the whole bundle folder over."
  else
    cli_fetch "${base}/${asset}" "${work}/${asset}" || die "Could not download ${asset}" "Run the command again."
  fi
  [[ "$(cli_sha256 "${work}/${asset}")" == "${sha}" ]] ||
    die "${asset} does not match the checksum in the signed release manifest" "Download it again; if it repeats, report it."
  cli_unpack_install "${work}/${asset}" "${name}"
)

cli_staged_dir() { printf '%s/cli-update' "${BEMMOLY_DIR}"; }
cli_staged_version() { cat "$(cli_staged_dir)/VERSION" 2>/dev/null; }

# The updater writes this folder from its own verified image; only root (and the updater,
# which holds the Docker socket) can, and the checksum catches a copy cut short.
cli_install_staged() (
  local dir work sha
  dir=$(cli_staged_dir)
  if [[ -n "$(find "${dir}" -maxdepth 1 \( ! -user "$(id -u)" -o -perm -020 -o -perm -002 \) 2>/dev/null)" ]]; then
    die "${dir} is writable by someone other than root" "Remove it: sudo rm -r ${dir}, then run: sudo bemmoly self-update"
  fi
  work=$(mktemp -d "${TMPDIR:-/tmp}/bemmoly-cli.XXXXXX")
  trap 'rm -rf "${work}"' EXIT
  cp "${dir}/bemmoly-cli.tar.gz" "${work}/" 2>/dev/null || die "${dir} has no bemmoly-cli.tar.gz" "Run: sudo bemmoly self-update"
  sha=$(awk '{ print $1; exit }' "${dir}/bemmoly-cli.tar.gz.sha256" 2>/dev/null)
  [[ -n "${sha}" && "$(cli_sha256 "${work}/bemmoly-cli.tar.gz")" == "${sha}" ]] ||
    die "The staged bemmoly command does not match its checksum" "Run: sudo bemmoly self-update"
  cli_unpack_install "${work}/bemmoly-cli.tar.gz" "$1"
)

# Before every command run as root: an in-app update staged a newer bemmoly command for
# the release the app now runs. Install it and run the command with it. Never backwards.
cli_apply_staged() {
  [[ -z "${BEMMOLY_CLI_REEXEC:-}" && -z "${CLI_FROM_CHECKOUT:-}" ]] || return 0
  local staged current
  staged=$(cli_staged_version) || return 0
  current=$(cli_version)
  if [[ "${staged}" != "$(env_value VERSION)" ]] || ! version_older "${current}" "${staged}"; then
    return 0
  fi
  if (cli_install_staged "${staged}") 2>>"${BEMMOLY_LOG}"; then
    note "The bemmoly command moved ${current} → ${staged}, from the in-app update" >&2
    cli_reexec "$@"
  fi
  warn "The bemmoly command for ${staged} could not be installed; still running ${current}. Run: sudo bemmoly self-update"
}

# After `bemmoly upgrade` moved the app: the command follows. Never fails the upgrade.
cli_follow_release() {
  local version="$1" current
  current=$(cli_version)
  if [[ -n "${CLI_FROM_CHECKOUT:-}" ]] || ! version_older "${current}" "${version}"; then
    return 0
  fi
  if [[ "$(cli_staged_version)" == "${version}" ]] && (cli_install_staged "${version}") 2>>"${BEMMOLY_LOG}"; then
    :
  elif [[ "$(env_value BEMMOLY_UPDATER_LOCAL_IMAGES)" == true ]]; then
    warn "The bemmoly command stays on ${current}; this install does not download releases"
    say "  Refresh it from the bundle folder: sudo bemmoly self-update --from <folder>"
    return 0
  elif ! cli_refresh "${version}"; then
    warn "Bemmoly ${version} is running, but the bemmoly command stays on ${current}"
    say "  Try again: sudo bemmoly self-update ${version}"
    return 0
  fi
  success "The bemmoly command moved ${current} → ${version}"
  cli_reexec version
}

cmd_self_update() {
  local version='' from=''
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --from) [[ $# -ge 2 ]] || die "--from needs a folder" "Pass the folder of an extracted bemmoly-airgap bundle."; from="$2"; shift 2 ;;
      --from=*) from="${1#--from=}"; shift ;;
      --yes | -y) shift ;;
      -*) die "Unknown option for self-update: $1" "Run: bemmoly self-update [version] [--from FOLDER]" ;;
      *) version="${1#v}"; shift ;;
    esac
  done
  [[ -z "${CLI_FROM_CHECKOUT:-}" ]] || die "This bemmoly runs from a checkout" "Update the checkout with git instead."
  if [[ -n "${from}" ]]; then
    [[ -d "${from}" ]] || die "${from} is not a folder" "Extract the bundle first: tar -xzf bemmoly-airgap-<version>-<arch>.tar.gz"
  else
    version="${version:-$(env_value VERSION)}"
    if [[ "${version}" == "$(cli_version)" ]]; then
      success "The bemmoly command is already ${version}"
      return 0
    fi
  fi
  [[ -z "${version}" ]] || semver_ok "${version}" || die "${version} is not a version" "Pass one like 1.2.0"
  say "Refreshing the bemmoly command $(cli_version) → ${version:-the release in ${from}}: download, signature, checksum, install."
  cli_refresh "${version}" "${from}" || exit 1
  success "The bemmoly command is $(cli_version)"
  cli_reexec version
}

cmd_version() {
  local cli app
  cli=$(cli_version)
  app=$(env_value VERSION)
  say "bemmoly command  ${cli}"
  say "app              ${app:-not installed}"
  say "updater          $(env_value UPDATER_VERSION)"
  if [[ -n "${app}" && "${cli}" != "${app}" && "${cli}" != checkout ]]; then
    say ''
    say "The bemmoly command is not from the app's release. Run: sudo bemmoly self-update"
  fi
}
