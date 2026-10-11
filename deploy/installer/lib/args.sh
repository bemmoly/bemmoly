# shellcheck shell=sh
# Installer flags. parse_args sets the variables below; tests call it directly.

usage() {
  cat <<'EOF'
Install Bemmoly on this machine.

  curl -fsSL https://get.bemmoly.com | sh -s -- [options]

Options:
  --domain NAME          the hostname people will use (asked when omitted)
  --version X.Y.Z        the version to install, or latest / beta (default: newest in the channel)
  --channel stable|beta  the update channel (default: stable)
  --modules a,b          pin the enabled modules, e.g. work,docs (default: chosen in the wizard)
  --no-proxy             no Caddy: you terminate HTTPS; the app listens on port 8080
  --no-in-app-updates    no updater container; update with `sudo bemmoly upgrade`
  --database-url URL     use an existing Postgres 18+ with pgvector instead of the bundled one
  --bundle FILE          install offline from bemmoly-airgap-<version>-<arch>.tar.gz (or the
                         folder it unpacks to); found by itself when install.sh sits in one
  --trusted-root FILE    Sigstore trusted_root.json, to check a bundle's signature offline
  --skip-signature-check you checked the bundle's signature on another machine
  --image-archive FILE   load images from an images.tar instead of pulling (no checks)
  --dir PATH             install folder (default: /var/bemmoly)
  --refresh-cli          only replace the bemmoly command with this release's; the app,
                         its version and its settings are not touched
  --yes                  do not ask; fail when something is missing
  --help                 this text
EOF
}

parse_args() {
  DOMAIN=''
  VERSION=''
  CHANNEL='stable'
  MODULES=''
  NO_PROXY=''
  NO_UPDATER=''
  EXTERNAL_DATABASE_URL=''
  IMAGE_ARCHIVE=''
  BUNDLE=''
  BUNDLE_TRUSTED_ROOT=''
  BUNDLE_SKIP_SIGNATURE=''
  INSTALL_DIR='/var/bemmoly'
  ASSUME_YES=''
  REFRESH_CLI=''
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --domain | --version | --channel | --modules | --database-url | --image-archive | --bundle | --trusted-root | --dir)
        [ "$#" -ge 2 ] || die "$1 needs a value" "Run with --help to see every option."
        arg_value "$1" "$2"
        shift 2
        ;;
      --domain=* | --version=* | --channel=* | --modules=* | --database-url=* | --image-archive=* | --bundle=* | --trusted-root=* | --dir=*)
        arg_value "${1%%=*}" "${1#*=}"
        shift
        ;;
      --no-proxy) NO_PROXY=1; shift ;;
      --no-in-app-updates) NO_UPDATER=1; shift ;;
      --refresh-cli) REFRESH_CLI=1; shift ;;
      --skip-signature-check) BUNDLE_SKIP_SIGNATURE=1; shift ;;
      --yes | -y) ASSUME_YES=1; shift ;;
      --help | -h) usage; exit 0 ;;
      *) die "Unknown option: $1" "Run with --help to see every option." ;;
    esac
  done
  validate_args
}

arg_value() {
  case "$1" in
    --domain) DOMAIN="$2" ;;
    --version) VERSION="${2#v}" ;;
    --channel) CHANNEL="$2" ;;
    --modules) MODULES="$2" ;;
    --database-url) EXTERNAL_DATABASE_URL="$2" ;;
    --image-archive) IMAGE_ARCHIVE="$2" ;;
    --bundle) BUNDLE="$2" ;;
    --trusted-root) BUNDLE_TRUSTED_ROOT="$2" ;;
    --dir) INSTALL_DIR="$2" ;;
  esac
}

validate_args() {
  case "${CHANNEL}" in
    stable | beta) ;;
    *) die "--channel must be stable or beta (got ${CHANNEL})" "Use --channel stable, or --channel beta for early releases." ;;
  esac
  # latest and beta are image tags; the installer pins the exact version after pulling.
  case "${VERSION}" in
    '' | latest | beta) ;;
    *) semver_ok "${VERSION}" || die "--version must look like 1.2.0, or be latest or beta (got ${VERSION})" \
      "Pick a version from https://github.com/bemmoly/bemmoly/releases." ;;
  esac
  if [ -n "${MODULES}" ] && ! printf '%s' "${MODULES}" | grep -Eq '^[a-z][a-z0-9-]*(,[a-z][a-z0-9-]*)*$'; then
    die "--modules must be a comma-separated list such as work,docs (got ${MODULES})" "Use module ids in lower case, without spaces."
  fi
  if [ -n "${DOMAIN}" ] && ! printf '%s' "${DOMAIN}" | grep -Eq '^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)*$'; then
    die "--domain must be a hostname such as bemmoly.example.com (got ${DOMAIN})" "Pass the name only, without https:// or a path."
  fi
  if [ -n "${EXTERNAL_DATABASE_URL}" ]; then
    case "${EXTERNAL_DATABASE_URL}" in
      postgres://* | postgresql://*) ;;
      *) die "--database-url must start with postgres://" "Use the form postgres://user:password@host:5432/bemmoly_db." ;;
    esac
  fi
  if [ -n "${IMAGE_ARCHIVE}" ] && [ ! -r "${IMAGE_ARCHIVE}" ]; then
    die "Cannot read ${IMAGE_ARCHIVE}" "Pass the path of images.tar from an unpacked bemmoly-airgap bundle, or use --bundle."
  fi
  if [ -n "${BUNDLE}" ] && [ -n "${IMAGE_ARCHIVE}" ]; then
    die "--bundle and --image-archive do not go together" "Pass only --bundle; it holds the images."
  fi
  if [ -n "${BUNDLE}" ] && [ ! -r "${BUNDLE}" ]; then
    die "Cannot read ${BUNDLE}" "Pass the path of the bemmoly-airgap-<version>-<arch>.tar.gz bundle on this machine."
  fi
  if [ -n "${BUNDLE_TRUSTED_ROOT}" ] && [ ! -r "${BUNDLE_TRUSTED_ROOT}" ]; then
    die "Cannot read ${BUNDLE_TRUSTED_ROOT}" "Pass Sigstore's trusted_root.json, copied from a connected machine."
  fi
  case "${INSTALL_DIR}" in
    /*) ;;
    *) die "--dir must be an absolute path (got ${INSTALL_DIR})" "For example --dir /srv/bemmoly." ;;
  esac
  if [ -n "${REFRESH_CLI}" ] &&
    [ -n "${DOMAIN}${MODULES}${NO_PROXY}${NO_UPDATER}${EXTERNAL_DATABASE_URL}${IMAGE_ARCHIVE}" ]; then
    die "--refresh-cli only replaces the bemmoly command and takes no install options" \
      "Run it with --dir, --version and --yes only."
  fi
}
