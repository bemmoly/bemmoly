# shellcheck shell=sh
# Images, start-up, certificate, the backup safety net, the CLI and the hand-off.

APP_IMAGE=ghcr.io/bemmoly/bemmoly
UPDATER_IMAGE=ghcr.io/bemmoly/updater

compose() {
  as_root docker compose --project-directory "${INSTALL_DIR}" "$@"
}

has_profile() {
  case ",$(compose_profiles)," in *",$1,"*) return 0 ;; *) return 1 ;; esac
}

# latest and beta are moving tags: pin the version the image says it is.
pin_version() {
  case "${VERSION}" in latest | beta) ;; *) return 0 ;; esac
  alias_tag="${VERSION}"
  label='{{index .Config.Labels "org.opencontainers.image.version"}}'
  exact=$(as_root docker image inspect "${APP_IMAGE}:${alias_tag}" --format "${label}" 2>/dev/null)
  semver_ok "${exact}" || die "${APP_IMAGE}:${alias_tag} does not say which version it is" "Install a numbered version with --version X.Y.Z."
  quietly as_root docker tag "${APP_IMAGE}:${alias_tag}" "${APP_IMAGE}:${exact}"
  if as_root docker image inspect "${UPDATER_IMAGE}:${alias_tag}" >/dev/null 2>&1; then
    quietly as_root docker tag "${UPDATER_IMAGE}:${alias_tag}" "${UPDATER_IMAGE}:${exact}"
  fi
  VERSION="${exact}"
  tmp=$(mktemp)
  as_root cat "${INSTALL_DIR}/.env" >"${tmp}"
  env_set "${tmp}" VERSION "${VERSION}"
  env_set "${tmp}" UPDATER_VERSION "${VERSION}"
  root_write "${INSTALL_DIR}/.env" 600 <"${tmp}"
  rm -f "${tmp}"
}

pull() {
  if [ -n "${IMAGE_ARCHIVE}" ]; then return 0; fi
  case "${VERSION}" in latest | beta) policy=always ;; *) policy=missing ;; esac
  quietly compose pull --policy "${policy}" "$@"
}

wait_healthy() {
  container="$1"
  limit="$2"
  waited=0
  while [ "${waited}" -lt "${limit}" ]; do
    status=$(as_root docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container}" 2>/dev/null || true)
    [ "${status}" = healthy ] && return 0
    sleep 3
    waited=$((waited + 3))
  done
  return 1
}

DB_IMAGE=pgvector/pgvector:pg18
MIN_POSTGRES_MAJOR=18

# "major|vector|trgm" for the --database-url server, e.g. "18|t|t": with the host's
# psql, else with the psql in the bundled database image.
query_external_database() {
  query="select current_setting('server_version_num')::int / 10000,
    exists(select 1 from pg_available_extensions where name = 'vector'),
    exists(select 1 from pg_available_extensions where name = 'pg_trgm')"
  if have psql; then
    PGCONNECT_TIMEOUT=10 psql --dbname="${EXTERNAL_DATABASE_URL}" --no-psqlrc --tuples-only \
      --no-align --field-separator='|' --command="${query}" 2>>"${BEMMOLY_LOG}"
  else
    as_root docker run --rm --network host -e PGCONNECT_TIMEOUT=10 "${DB_IMAGE}" \
      psql --dbname="${EXTERNAL_DATABASE_URL}" --no-psqlrc --tuples-only --no-align \
      --field-separator='|' --command="${query}" 2>>"${BEMMOLY_LOG}"
  fi
}

# Why a "major|vector|trgm" answer cannot run Bemmoly: the message, then the fix, one
# per line; nothing when it can.
database_requirement_problem() {
  major="${1%%|*}"
  rest="${1#*|}"
  vector="${rest%%|*}"
  trgm="${rest#*|}"
  if [ "${major}" -lt "${MIN_POSTGRES_MAJOR}" ]; then
    printf 'The database at --database-url runs Postgres %s; Bemmoly needs Postgres %s or later with pgvector\n' "${major}" "${MIN_POSTGRES_MAJOR}"
    printf 'Upgrade it to Postgres %s with pgvector (the %s image), or install without --database-url to use the bundled database.\n' "${MIN_POSTGRES_MAJOR}" "${DB_IMAGE}"
    return 0
  fi
  missing=''
  [ "${vector}" = t ] || missing='pgvector'
  [ "${trgm}" = t ] || missing="${missing:+${missing} and }pg_trgm"
  if [ -n "${missing}" ]; then
    printf 'The database at --database-url (Postgres %s) does not have %s installed; Bemmoly needs it\n' "${major}" "${missing}"
    printf 'Install %s on the database server (the %s image has both), or install without --database-url.\n' "${missing}" "${DB_IMAGE}"
  fi
}

# Before anything is written: the schema needs uuidv7() (Postgres 18) and pgvector.
check_external_database() {
  [ -n "${EXTERNAL_DATABASE_URL}" ] || return 0
  step "Checking the database at --database-url"
  if ! have psql && [ -n "${IMAGE_ARCHIVE}" ] && ! as_root docker image inspect "${DB_IMAGE}" >/dev/null 2>&1; then
    step_done skipped
    warn "No psql here to check the database with; Bemmoly checks for Postgres ${MIN_POSTGRES_MAJOR} with pgvector when it starts."
    return 0
  fi
  answer=$(query_external_database | tr -d ' ' | head -n 1) || answer=''
  case "${answer}" in
    [0-9]*'|'[tf]'|'[tf]) ;;
    *) die "Could not query the database at --database-url" \
      "Check the URL, the password and that this machine can reach the database." ;;
  esac
  problem=$(database_requirement_problem "${answer}")
  if [ -n "${problem}" ]; then
    die "$(printf '%s\n' "${problem}" | sed -n 1p)" "$(printf '%s\n' "${problem}" | sed -n 2p)"
  fi
  step_done "Postgres ${answer%%|*}, pgvector"
}

start_stack() {
  if [ -n "${IMAGE_ARCHIVE}" ]; then
    step "Loading images from $(basename "${IMAGE_ARCHIVE}")"
    quietly as_root docker load -i "${IMAGE_ARCHIVE}" || die "The image bundle could not be loaded" "Check the file is a complete bemmoly-airgap bundle."
    step_done
  fi
  if has_profile db; then
    step "Installing Postgres 18 (pgvector)"
    pull db || die "Could not pull pgvector/pgvector:pg18" "Check outbound HTTPS to Docker Hub, or use --image-archive."
    quietly compose up -d db || die "Postgres did not start" "Run: sudo bemmoly logs db"
    wait_healthy bemmoly-db-1 180 || die "Postgres is not healthy after 3 minutes" "Run: sudo bemmoly logs db"
    step_done
  fi
  # The bundle already loaded the images: nothing is pulled.
  if [ -n "${IMAGE_ARCHIVE}" ]; then step "Starting bemmoly:${VERSION}"; else step "Pulling bemmoly:${VERSION}"; fi
  services='bemmoly'
  has_profile proxy && services="${services} proxy"
  has_profile updater && services="${services} updater"
  # shellcheck disable=SC2086
  pull ${services} || die "Could not pull ${APP_IMAGE}:${VERSION}" \
    "Check the version exists (https://github.com/bemmoly/bemmoly/releases) and outbound HTTPS to ghcr.io, or use --image-archive."
  pin_version
  quietly compose up -d --remove-orphans || die "The stack did not start" "Run: sudo bemmoly logs"
  wait_healthy bemmoly-bemmoly-1 300 || die "Bemmoly did not become healthy within 5 minutes" "Run: sudo bemmoly logs bemmoly"
  step_done
}

# https_answers [-k]   true when the proxy serves /healthz over HTTPS.
https_answers() {
  curl -fsS ${1:+"$1"} --max-time 5 --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/healthz" >/dev/null 2>&1
}

# wait_https [-k] SECONDS   true as soon as HTTPS answers, false after SECONDS.
wait_https() {
  _https_waited=0
  until https_answers "$1"; do
    [ "${_https_waited}" -lt "$2" ] || return 1
    sleep 3
    _https_waited=$((_https_waited + 3))
  done
}

# Only "auto" can expect a trusted certificate now. An "internal" name does not point here
# (or never can), so Caddy serves its own certificate within seconds; waiting out the ACME
# window for a trusted one would only delay the install.
request_certificate() {
  [ -z "${NO_PROXY}" ] || return 0
  if [ "${TLS_MODE}" = internal ]; then
    step "Issuing a self-signed certificate for ${DOMAIN}"
    if wait_https -k 15; then
      SELF_SIGNED=1
      step_done
      return 0
    fi
  else
    step "Requesting certificate for ${DOMAIN}"
    if wait_https '' 90; then
      step_done
      return 0
    fi
    if https_answers -k; then
      step_done 'self-signed for now'
      SELF_SIGNED=1
      return 0
    fi
  fi
  step_done 'not yet'
  warn "HTTPS does not answer yet; check with: sudo bemmoly doctor"
}

# The app schedules backups itself; this timer only backs up when it has not for 36 hours.
schedule_backups() {
  if have systemctl && [ -d /run/systemd/system ]; then
    asset bemmoly-backup.service | root_write /etc/systemd/system/bemmoly-backup.service 644
    asset bemmoly-backup.timer | root_write /etc/systemd/system/bemmoly-backup.timer 644
    quietly as_root systemctl daemon-reload
    quietly as_root systemctl enable --now bemmoly-backup.timer || warn "The backup safety-net timer did not start; the app's own schedule still runs."
  fi
  note "Nightly backup scheduled 02:00 → ${INSTALL_DIR}/backups"
}

# The release the bemmoly command comes from: the bundle's, or "dev" from a checkout.
cli_release() {
  if semver_ok "${BEMMOLY_DEFAULT_VERSION:-}"; then printf '%s' "${BEMMOLY_DEFAULT_VERSION}"; else printf dev; fi
}

install_cli() {
  as_root install -d -m 755 /usr/local/lib/bemmoly
  for name in common.sh preflight.sh bundle.sh cli-stack.sh cli-backups.sh cli-updates.sh cli-selfupdate.sh; do
    asset "${name}" | root_write "/usr/local/lib/bemmoly/${name}" 644
  done
  asset bemmoly | root_write /usr/local/bin/bemmoly 755
  printf "%s\n" "$(cli_release)" | root_write /usr/local/lib/bemmoly/VERSION 644
  as_root install -d -m 755 /usr/share/bash-completion/completions
  asset completion.bash | root_write /usr/share/bash-completion/completions/bemmoly 644
  if [ "${INSTALL_DIR}" != /var/bemmoly ]; then
    printf 'BEMMOLY_DIR=%s\n' "${INSTALL_DIR}" | root_write /etc/default/bemmoly 644
  fi
}

# --refresh-cli: the bemmoly command of this installer's release, for an install whose
# command predates self-update (ADR 0024). Images, .env and containers stay as they are.
refresh_cli() {
  as_root test -f "${INSTALL_DIR}/.env" ||
    die "No Bemmoly install in ${INSTALL_DIR}" "Pass its folder with --dir, or install without --refresh-cli."
  if [ -n "${VERSION}" ] && [ "$(cli_release)" != dev ] && [ "${VERSION}" != "$(cli_release)" ]; then
    die "This installer carries the bemmoly command of $(cli_release), not ${VERSION}" \
      "Run: curl -fsSL https://get.bemmoly.com | sh -s -- --refresh-cli --version ${VERSION}"
  fi
  step "Replacing the bemmoly command with $(cli_release)'s"
  install_cli
  step_done
  app=$(as_root cat "${INSTALL_DIR}/.env" | env_get /dev/stdin VERSION)
  success "The bemmoly command is $(cli_release); Bemmoly itself stays on ${app}"
  say "  Check with 'sudo bemmoly version'. From now on 'sudo bemmoly upgrade' and in-app updates"
  say "  keep the command on the app's release, and 'sudo bemmoly self-update' refreshes it."
}

# A re-run after the first admin exists: the app answers on loopback in every layout.
setup_done() {
  curl -fsS --max-time 5 http://127.0.0.1:8080/api/v1/setup/status 2>/dev/null | grep -q '"initialized":true'
}

final_message() {
  url=$(as_root cat "${INSTALL_DIR}/.env" | env_get /dev/stdin BEMMOLY_PUBLIC_URL)
  success "Bemmoly is running at ${url}"
  if setup_done; then say "  Open it to sign in."; else say "  Open it to create the first admin."; fi
  if [ -n "${SELF_SIGNED:-}" ]; then
    if local_only_name "${DOMAIN}"; then
      say "  ${DOMAIN} is a local-only name, so its certificate stays self-signed and browsers warn."
      say "  For a trusted one, re-run with --domain set to a public name that points at this machine."
    else
      say "  The certificate is self-signed until ${DOMAIN} points at this machine; a real one follows by itself."
    fi
  fi
  say ''
  say "  Keep a copy of ${INSTALL_DIR}/.env somewhere safe. It holds the key that decrypts"
  say "  stored credentials and the backup passphrase, and backups do not contain it."
  say "  Run 'sudo bemmoly status' any time; 'sudo bemmoly doctor' explains problems."
}
