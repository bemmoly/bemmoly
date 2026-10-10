#!/bin/sh
# Bemmoly installer. Keep your work in-house.
#
#   curl -fsSL https://get.bemmoly.com | sh
#   curl -fsSL https://get.bemmoly.com | sh -s -- --domain bemmoly.example.com --yes
#
# Three ways this file runs:
#   - from a checkout (sudo sh deploy/install.sh): it sources deploy/installer/lib;
#   - served by get.bemmoly.com and piped into sh: it fetches the bundled installer of the
#     matching GitHub release (bemmoly-installer.sh, which carries that release's Compose
#     file and Caddyfile), checks its SHA-256 and runs it with the same options;
#   - as part of that bundle (BEMMOLY_BUNDLED=1), built by deploy/scripts/bundle-installer.sh.
# Run with --help for the options. MIT licensed.
set -eu

BEMMOLY_BUNDLED="${BEMMOLY_BUNDLED:-}"
RELEASES=https://github.com/bemmoly/bemmoly/releases

bootstrap_fail() {
  printf '\n✗ %s\n  Fix: %s\n' "$1" "$2" >&2
  exit 1
}

latest_prerelease_tag() {
  curl -fsSL -H 'Accept: application/vnd.github+json' \
    'https://api.github.com/repos/bemmoly/bemmoly/releases?per_page=20' |
    awk -F'"' '/"tag_name":/ { tag = $4 } /"prerelease": *true/ && tag != "" { print tag; exit }'
}

# The release the options ask for: --version X.Y.Z, latest (default) or the beta channel.
bootstrap() {
  want_version=""
  want_channel=stable
  previous=''
  for arg in "$@"; do
    case "${previous}" in --version) want_version="${arg#v}" ;; --channel) want_channel="${arg}" ;; esac
    case "${arg}" in
      --version=*) want_version="${arg#--version=}" && want_version="${want_version#v}" ;;
      --channel=*) want_channel="${arg#--channel=}" ;;
    esac
    previous="${arg}"
  done
  if [ "${want_version}" = beta ] || { [ -z "${want_version}" ] && [ "${want_channel}" = beta ]; }; then
    tag=$(latest_prerelease_tag) || tag=''
    [ -n "${tag}" ] || bootstrap_fail 'No beta release was found' 'Install a numbered version with --version X.Y.Z.'
    base="${RELEASES}/download/${tag}"
  elif [ -z "${want_version}" ] || [ "${want_version}" = latest ]; then
    base="${RELEASES}/latest/download"
  else
    base="${RELEASES}/download/v${want_version}"
  fi
  command -v curl >/dev/null 2>&1 || bootstrap_fail 'curl is not installed' 'Install curl, then run the installer again.'
  work=$(mktemp -d)
  if ! curl -fsSL -o "${work}/bemmoly-installer.sh" "${base}/bemmoly-installer.sh" ||
    ! curl -fsSL -o "${work}/bemmoly-installer.sh.sha256" "${base}/bemmoly-installer.sh.sha256"; then
    bootstrap_fail "Could not download the installer from ${base}" \
      'Check the version exists (https://github.com/bemmoly/bemmoly/releases) and outbound HTTPS to github.com.'
  fi
  expected=$(awk '{ print $1; exit }' "${work}/bemmoly-installer.sh.sha256")
  actual=$(sha256sum "${work}/bemmoly-installer.sh" | awk '{ print $1 }')
  if [ -z "${expected}" ] || [ "${expected}" != "${actual}" ]; then
    bootstrap_fail 'The downloaded installer does not match its checksum' 'Run the command again; if it repeats, report it.'
  fi
  exec sh "${work}/bemmoly-installer.sh" "$@"
}

if [ -z "${BEMMOLY_BUNDLED}" ]; then
  case "$0" in */*) DEPLOY_DIR=$(cd "$(dirname "$0")" && pwd) ;; *) DEPLOY_DIR='' ;; esac
  if [ -z "${DEPLOY_DIR}" ] || [ ! -f "${DEPLOY_DIR}/installer/lib/common.sh" ]; then
    bootstrap "$@"
  fi
  for lib in common args preflight docker config start; do
    # shellcheck source=/dev/null
    . "${DEPLOY_DIR}/installer/lib/${lib}.sh"
  done
fi

# Files the installer writes, from the checkout or from the bundle.
asset() {
  if [ -n "${BEMMOLY_BUNDLED}" ]; then
    bundled_asset "$1"
    return
  fi
  case "$1" in
    docker-compose.yml | Caddyfile | env.template) cat "${DEPLOY_DIR}/compose/$1" ;;
    common.sh | preflight.sh) cat "${DEPLOY_DIR}/installer/lib/$1" ;;
    cli-*.sh) cat "${DEPLOY_DIR}/cli/lib/${1#cli-}" ;;
    bemmoly) cat "${DEPLOY_DIR}/cli/bemmoly" ;;
    completion.bash) cat "${DEPLOY_DIR}/cli/completion.bash" ;;
    bemmoly-backup.service | bemmoly-backup.timer) cat "${DEPLOY_DIR}/installer/systemd/$1" ;;
    *) die "Unknown installer asset $1" "This is a bug in the installer; please report it." ;;
  esac
}

main() {
  parse_args "$@"
  : "${BEMMOLY_DEFAULT_VERSION:=}"
  if [ -z "${VERSION}" ]; then
    VERSION="${BEMMOLY_DEFAULT_VERSION}"
    [ -n "${VERSION}" ] || { [ "${CHANNEL}" = beta ] && VERSION=beta || VERSION=latest; }
  fi
  BEMMOLY_LOG="$(mktemp /tmp/bemmoly-install.XXXXXX)"
  export BEMMOLY_LOG

  run_preflight "${INSTALL_DIR}"
  note "Detected $(describe_machine)"
  ensure_docker
  configure
  # Before start-up, so the fixes printed on a failure (`bemmoly logs …`) work.
  install_cli
  start_stack
  request_certificate
  schedule_backups
  final_message
  as_root install -m 600 "${BEMMOLY_LOG}" "${INSTALL_DIR}/install.log"
  rm -f "${BEMMOLY_LOG}"
}

main "$@"
