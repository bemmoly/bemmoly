#!/bin/sh
# Bemmoly installer. Your work. Your platform.
#
#   curl -fsSL https://get.bemmoly.dev | sh
#   curl -fsSL https://get.bemmoly.dev | sh -s -- --domain bemmoly.example.com --yes
#
# From a checkout this file sources deploy/installer/lib; the published installer is the
# same code in one file, built by deploy/scripts/bundle-installer.sh. Run with --help
# for the options. MIT licensed.
set -eu

BEMMOLY_BUNDLED="${BEMMOLY_BUNDLED:-}"

if [ -z "${BEMMOLY_BUNDLED}" ]; then
  DEPLOY_DIR=$(cd "$(dirname "$0")" && pwd)
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
  start_stack
  request_certificate
  install_cli
  schedule_backups
  final_message
  as_root install -m 600 "${BEMMOLY_LOG}" "${INSTALL_DIR}/install.log"
  rm -f "${BEMMOLY_LOG}"
}

main "$@"
