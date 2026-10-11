#!/bin/sh
# Runs inside the container cli-self-update.sh starts, as root, with deploy/ at /deploy
# and the 0.11.0 installer at /old. See that file.
set -eu

RELEASES=/srv/releases
PORT=18765
ENV_FILE=/var/bemmoly/.env

fail() {
  printf '✗ %s\n' "$1" >&2
  [ -z "${2:-}" ] || printf '%s\n' "$2" | sed 's/^/  | /' >&2
  exit 1
}
pass() { printf '✓ %s\n' "$1"; }
cli_release() { cat /usr/local/lib/bemmoly/VERSION 2>/dev/null || echo none; }
sum() { sha256sum "$1" | awk '{ print $1 }'; }

# expect "description" "text the output must contain" command...
expect() {
  _what="$1"
  _want="$2"
  shift 2
  _out=$("$@" 2>&1) || true
  case "${_out}" in *"${_want}"*) pass "${_what}" ;; *) fail "${_what}: no \"${_want}\"" "${_out}" ;; esac
}

# --- the machine: a release server, a Docker stand-in, cosign with a test key ----------
mkdir -p /keys /var/bemmoly "${RELEASES}"
(cd /keys && COSIGN_PASSWORD='' cosign-real generate-key-pair >/dev/null 2>&1)
mkdir -p /keys/other && (cd /keys/other && COSIGN_PASSWORD='' cosign-real generate-key-pair >/dev/null 2>&1)
# A test key's signature has no transparency-log entry; the rest is cosign's real check.
printf '#!/bin/sh\nexec cosign-real "$@" --insecure-ignore-tlog=true\n' >/usr/local/bin/cosign
# The updater "upgrades" by writing .env, as the real one does once the app is healthy.
cat >/usr/local/bin/docker <<'EOF'
#!/bin/sh
case "$1" in
  inspect) echo bemmoly_internal ;;
  image) exit 1 ;;
  run)
    previous=''
    for arg in "$@"; do [ "${previous}" = upgrade ] && version="${arg}"; previous="${arg}"; done
    sed -i "s/^VERSION=.*/VERSION=${version}/; s/^UPDATER_VERSION=.*/UPDATER_VERSION=${version}/" /var/bemmoly/.env
    ;;
esac
EOF
chmod +x /usr/local/bin/cosign /usr/local/bin/docker
touch /var/bemmoly/docker-compose.yml
cat >"${ENV_FILE}" <<EOF
VERSION=9.8.0
UPDATER_VERSION=9.8.0
BEMMOLY_RELEASES_URL=http://127.0.0.1:${PORT}
COSIGN_PUBLIC_KEY=/keys/cosign.pub
UPDATER_TOKEN=not-a-real-token
EOF
chmod 600 "${ENV_FILE}"

# make_release VERSION [KEY_DIR] [FOLDER]: the CLI tarball and a manifest signed with KEY_DIR's key.
make_release() {
  dir="${3:-${RELEASES}/v$1}"
  mkdir -p "${dir}"
  sh /deploy/scripts/release-cli.sh "$1" "${dir}" >/dev/null
  cat >"${dir}/release-manifest.json" <<EOF
{
  "version": "$1",
  "channel": "stable",
  "cli": {
    "asset": "bemmoly-cli-$1.tar.gz",
    "sha256": "$(sum "${dir}/bemmoly-cli-$1.tar.gz")"
  },
  "rollback": "code"
}
EOF
  COSIGN_PASSWORD='' cosign-real sign-blob --yes --key "${2:-/keys}/cosign.key" --tlog-upload=false \
    --use-signing-config=false --bundle "${dir}/release-manifest.json.sigstore.json" \
    "${dir}/release-manifest.json" >/dev/null 2>&1
}
for version in 9.9.0 9.9.1; do make_release "${version}"; done
make_release 9.9.2 /keys/other
python3 -m http.server "${PORT}" --bind 127.0.0.1 --directory "${RELEASES}" >/tmp/http.log 2>&1 &
server=$!
for _ in 1 2 3 4 5 6 7 8 9 10; do curl -fs "http://127.0.0.1:${PORT}/" >/dev/null && break; sleep 0.3; done
curl -fs "http://127.0.0.1:${PORT}/v9.9.0/release-manifest.json" >/dev/null || fail 'the release server did not start' "$(cat /tmp/http.log)"

# --- an install from 0.11.0: its command has no self-update ----------------------------
mkdir -p /usr/local/lib/bemmoly
for name in common.sh preflight.sh cli-stack.sh cli-backups.sh cli-updates.sh bemmoly; do
  case "${name}" in bemmoly) target=/usr/local/bin/bemmoly ;; *) target="/usr/local/lib/bemmoly/${name}" ;; esac
  sed -n "/^    ${name})$/,/^BEMMOLY_ASSET_END$/p" /old/bemmoly-installer.sh | sed '1,2d;$d' >"${target}"
done
chmod 755 /usr/local/bin/bemmoly
expect 'the 0.11.0 command does not know self-update' 'Unknown command: self-update' bemmoly self-update

# --- bootstrap: the installer replaces only the command ---------------------------------
sh /deploy/scripts/bundle-installer.sh --version 9.8.0 >/tmp/install.sh
env_before=$(sum "${ENV_FILE}")
expect 'install.sh --refresh-cli replaces the command' 'Bemmoly itself stays on 9.8.0' sh /tmp/install.sh --refresh-cli --yes
[ "$(sum "${ENV_FILE}")" = "${env_before}" ] || fail '--refresh-cli changed .env'
[ "$(cli_release)" = 9.8.0 ] || fail "the command is $(cli_release), not 9.8.0"
expect 'the refreshed command reports its release' 'bemmoly command  9.8.0' bemmoly version

# --- upgrade: the app moves, then the command follows from the signed release -----------
expect 'upgrade moves the command after the app' 'The bemmoly command moved 9.8.0 → 9.9.0' bemmoly upgrade 9.9.0 --yes
expect 'the new command runs after the upgrade' 'bemmoly command  9.9.0' bemmoly version
[ "$(cli_release)" = 9.9.0 ] || fail "the command is $(cli_release), not 9.9.0"

# --- signature failures change nothing ---------------------------------------------------
bin_before=$(sum /usr/local/bin/bemmoly)
sed -i 's/"rollback": "code"/"rollback": "restore"/' "${RELEASES}/v9.9.1/release-manifest.json"
expect 'a manifest changed after signing is refused' 'does not verify. The bemmoly command was not changed' \
  bemmoly self-update 9.9.1
expect 'a manifest signed by another key is refused' 'does not verify' bemmoly self-update 9.9.2
[ "$(cli_release)" = 9.9.0 ] && [ "$(sum /usr/local/bin/bemmoly)" = "${bin_before}" ] ||
  fail 'a refused release changed the command'
expect 'a refused command never fails the upgrade' 'the bemmoly command stays on 9.9.0' bemmoly upgrade 9.9.1 --yes
grep -q '^VERSION=9.9.1$' "${ENV_FILE}" || fail 'the app did not reach 9.9.1'
pass 'the command stayed on 9.9.0 after every refused signature'

# --- air gap: no server, an extracted bundle folder -------------------------------------
kill "${server}"
make_release 9.9.3 /keys /bundle
expect 'self-update --from a bundle works offline' 'bemmoly command  9.9.3' bemmoly self-update --from /bundle

# --- in-app update: the updater's staged copy is picked up by the next command ----------
make_release 9.9.4 /keys /tmp/staging
mkdir -p /var/bemmoly/cli-update
cp /tmp/staging/bemmoly-cli-9.9.4.tar.gz /var/bemmoly/cli-update/bemmoly-cli.tar.gz
(cd /var/bemmoly/cli-update && sha256sum bemmoly-cli.tar.gz >bemmoly-cli.tar.gz.sha256 && echo 9.9.4 >VERSION)
sed -i 's/^VERSION=.*/VERSION=9.9.4/' "${ENV_FILE}"
expect 'the next command installs the staged copy' 'moved 9.9.3 → 9.9.4, from the in-app update' bemmoly version
[ "$(cli_release)" = 9.9.4 ] || fail "the command is $(cli_release), not 9.9.4"
pass 'an old command ends on the release it manages'
