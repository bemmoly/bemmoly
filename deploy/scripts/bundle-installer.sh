#!/bin/sh
# Builds the one-file installer that get.bemmoly.dev serves and each release attaches:
# the installer libraries, then every file it writes (Compose file, Caddyfile, .env
# template, the bemmoly CLI, completion, systemd units) as heredocs, then the entry.
#
#   sh deploy/scripts/bundle-installer.sh [--version X.Y.Z] > install.sh
set -eu

DEPLOY_DIR=$(cd "$(dirname "$0")/.." && pwd)
DEFAULT_VERSION=''
if [ "${1:-}" = --version ]; then
  DEFAULT_VERSION="${2:?--version needs a value}"
fi

DELIMITER=BEMMOLY_ASSET_END

strip_header() {
  sed -e '1{/^#!/d;}' -e '/^# shellcheck shell=/d' "$1"
}

emit_asset() {
  name="$1"
  file="$2"
  if grep -qx "${DELIMITER}" "${file}"; then
    echo "bundle-installer: ${file} contains the line ${DELIMITER}" >&2
    exit 1
  fi
  printf "    %s)\n      cat <<'%s'\n" "${name}" "${DELIMITER}"
  cat "${file}"
  printf '%s\n      ;;\n' "${DELIMITER}"
}

cat <<EOF
#!/bin/sh
# Bemmoly installer, bundled from deploy/ in https://github.com/bemmoly/bemmoly (MIT).
#
#   curl -fsSL https://get.bemmoly.dev | sh
#   curl -fsSL https://get.bemmoly.dev | sh -s -- --help
set -eu
BEMMOLY_BUNDLED=1
BEMMOLY_DEFAULT_VERSION='${DEFAULT_VERSION}'
EOF

for lib in common args preflight docker config start; do
  printf '\n# --- installer/lib/%s.sh\n' "${lib}"
  strip_header "${DEPLOY_DIR}/installer/lib/${lib}.sh"
done

# shellcheck disable=SC2016 # $1 belongs to the generated function
printf '\n# --- files the installer writes\nbundled_asset() {\n  case "$1" in\n'
emit_asset docker-compose.yml "${DEPLOY_DIR}/compose/docker-compose.yml"
emit_asset Caddyfile "${DEPLOY_DIR}/compose/Caddyfile"
emit_asset env.template "${DEPLOY_DIR}/compose/env.template"
emit_asset common.sh "${DEPLOY_DIR}/installer/lib/common.sh"
emit_asset preflight.sh "${DEPLOY_DIR}/installer/lib/preflight.sh"
for part in stack backups updates; do
  emit_asset "cli-${part}.sh" "${DEPLOY_DIR}/cli/lib/${part}.sh"
done
emit_asset bemmoly "${DEPLOY_DIR}/cli/bemmoly"
emit_asset completion.bash "${DEPLOY_DIR}/cli/completion.bash"
emit_asset bemmoly-backup.service "${DEPLOY_DIR}/installer/systemd/bemmoly-backup.service"
emit_asset bemmoly-backup.timer "${DEPLOY_DIR}/installer/systemd/bemmoly-backup.timer"
# shellcheck disable=SC2016
printf '    *) die "Unknown installer asset $1" "This is a bug in the installer; please report it." ;;\n  esac\n}\n'

printf '\n# --- install.sh\n'
# The entry without its header, the BEMMOLY_BUNDLED default and the checkout-only sourcing.
sed -e '1,/^set -eu$/d' -e '/^BEMMOLY_BUNDLED=/d' "${DEPLOY_DIR}/install.sh"
