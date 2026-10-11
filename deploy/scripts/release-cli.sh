#!/bin/sh
# Writes bemmoly-cli-<version>.tar.gz and its SHA-256: the host bemmoly command of one
# release, laid out as it is installed (ADR 0024). The release manifest lists the
# tarball's checksum and is signed, so `bemmoly self-update` and `bemmoly upgrade` can
# trust it; the updater image carries the same tarball for in-app updates.
#
#   sh deploy/scripts/release-cli.sh <version> <outdir>
#
# Layout, a contract with every older bemmoly self-update:
#   bemmoly-cli/bemmoly           -> /usr/local/bin/bemmoly
#   bemmoly-cli/lib/*.sh          -> /usr/local/lib/bemmoly/
#   bemmoly-cli/completion.bash   -> /usr/share/bash-completion/completions/bemmoly
#   bemmoly-cli/VERSION           -> /usr/local/lib/bemmoly/VERSION (installed last)
set -eu

VERSION="${1:?usage: release-cli.sh <version> <outdir>}"
OUTDIR="${2:?usage: release-cli.sh <version> <outdir>}"
DEPLOY_DIR=$(cd "$(dirname "$0")/.." && pwd)
NAME="bemmoly-cli-${VERSION}.tar.gz"

printf '%s' "${VERSION}" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$' || {
  echo "release-cli: ${VERSION} is not a version" >&2
  exit 1
}

mkdir -p "${OUTDIR}"
OUTDIR=$(cd "${OUTDIR}" && pwd)
work=$(mktemp -d)
trap 'rm -rf "${work}"' EXIT
tree="${work}/bemmoly-cli"
mkdir -p "${tree}/lib"
cp "${DEPLOY_DIR}/cli/bemmoly" "${tree}/bemmoly"
cp "${DEPLOY_DIR}/cli/completion.bash" "${tree}/completion.bash"
cp "${DEPLOY_DIR}/installer/lib/common.sh" "${DEPLOY_DIR}/installer/lib/preflight.sh" \
  "${DEPLOY_DIR}/installer/lib/bundle.sh" "${tree}/lib/"
for part in "${DEPLOY_DIR}"/cli/lib/*.sh; do
  cp "${part}" "${tree}/lib/cli-$(basename "${part}")"
done
printf '%s\n' "${VERSION}" >"${tree}/VERSION"
chmod 755 "${tree}/bemmoly"
chmod 644 "${tree}/completion.bash" "${tree}/VERSION" "${tree}"/lib/*.sh

# No macOS resource forks, no timestamps in the gzip header.
COPYFILE_DISABLE=1 tar -cf - -C "${work}" bemmoly-cli | gzip -n >"${OUTDIR}/${NAME}"
cd "${OUTDIR}"
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "${NAME}" >"${NAME}.sha256"
else
  shasum -a 256 "${NAME}" >"${NAME}.sha256"
fi
echo "✓ ${OUTDIR}/${NAME} and its checksum"
