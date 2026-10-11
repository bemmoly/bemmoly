# shellcheck shell=sh
# Domain, TLS mode, Postgres tuning, secrets and the files in the install folder.

APP_UID=10001

# Writes stdin to a root-owned file with the given mode.
root_write() {
  # shellcheck disable=SC2016
  as_root sh -c 'umask 077; cat > "$1.tmp" && chmod "$2" "$1.tmp" && mv "$1.tmp" "$1"' sh "$1" "$2"
}

choose_domain() {
  if [ -z "${DOMAIN}" ] && [ -n "${NO_PROXY}" ]; then
    DOMAIN=$(hostname -I 2>/dev/null | awk '{ print $1 }')
  fi
  if [ -z "${DOMAIN}" ] && interactive; then
    DOMAIN=$(ask 'Domain name for Bemmoly (for example bemmoly.example.com): ')
    validate_args
  fi
  [ -n "${DOMAIN}" ] || die "No domain name was given" \
    "Re-run with --domain bemmoly.example.com, after pointing that name's DNS A record at this machine."
}

# Names no public certificate authority will ever sign: local suffixes and bare addresses.
local_only_name() {
  case "$1" in
    localhost | *.localhost | *.local | *.test | *.internal | *.lan) return 0 ;;
  esac
  printf '%s' "$1" | grep -Eq '^[0-9.]+$'
}

# The address people reach this machine on: the public one when a lookup service answers,
# the first local one otherwise.
public_ip() {
  curl -fsS4 --max-time 5 https://api.ipify.org 2>/dev/null \
    || hostname -I 2>/dev/null | awk '{ print $1 }'
}

# Best guess at the DNS zone: the last two labels (bemmoly.acme.com gives acme.com).
dns_zone() {
  printf '%s' "$1" | awk -F. '{ if (NF <= 2) print $0; else print $(NF-1) "." $NF }'
}

# The record name inside the zone: "bemmoly" for bemmoly.acme.com, "@" for acme.com.
dns_record_name() {
  zone_name=$(dns_zone "$1")
  if [ "$1" = "${zone_name}" ]; then echo '@'; else printf '%s\n' "${1%."${zone_name}"}"; fi
}

dns_on_cloudflare() {
  have dig && dig +short NS "$1" 2>/dev/null | grep -q '\.ns\.cloudflare\.com\.\?$'
}

dns_points_here() {
  getent ahostsv4 "$1" 2>/dev/null | awk '{ print $1 }' | grep -qx "$2"
}

# Shows the A record to add, with a Cloudflare link when the zone lives there, and waits
# for the user to add it. Install goes on either way; the certificate follows the record.
dns_guide() {
  if [ -n "${NO_PROXY}" ] || local_only_name "${DOMAIN}"; then return; fi
  server_ip=$(public_ip)
  [ -n "${server_ip}" ] || return
  if dns_points_here "${DOMAIN}" "${server_ip}"; then
    success "${DOMAIN} already points at this server (${server_ip})"
    return
  fi
  zone=$(dns_zone "${DOMAIN}")
  say ''
  say "  Point ${DOMAIN} at this server"
  say "  Add this record where you manage DNS for ${zone}:"
  say ''
  printf '    %-6s %-20s %-16s %s\n' Type Name Value TTL
  printf '    %-6s %-20s %-16s %s\n' A "$(dns_record_name "${DOMAIN}")" "${server_ip}" Auto
  say ''
  if dns_on_cloudflare "${zone}"; then
    say "  ${zone} is on Cloudflare. Add the record there:"
    say "    https://dash.cloudflare.com/?to=/:account/${zone}/dns/records"
    say '  Set Proxy status to "DNS only" (grey cloud) so the certificate can be issued.'
    say ''
  fi
  interactive || return
  ask '  Press Enter once the record is added (or now, to add it later): ' >/dev/null
  if dns_points_here "${DOMAIN}" "${server_ip}"; then
    success "${DOMAIN} points at this server"
  else
    note "${DOMAIN} does not point here yet; DNS can take a few minutes. The certificate stays self-signed until it does, then a real one is issued by itself."
  fi
}

# "auto" when the name already resolves to an address of this machine; "internal" when it
# does not (yet), or is local-only. Caddy tries a real certificate first in both cases.
tls_mode_for() {
  if local_only_name "$1"; then echo internal; return; fi
  resolved=$(getent ahostsv4 "$1" 2>/dev/null | awk '{ print $1 }' | sort -u)
  for address in ${resolved}; do
    for own in $(hostname -I 2>/dev/null); do
      if [ "${address}" = "${own}" ]; then echo auto; return; fi
    done
  done
  echo internal
}

# shared_buffers an eighth of memory, effective_cache_size three eighths: the app and the
# page cache share the machine (4 GB gives 512MB and 1536MB, as in the design).
tune_postgres() {
  PG_SHARED_BUFFERS="$((MEM_MB / 8 < 128 ? 128 : MEM_MB / 8))MB"
  PG_EFFECTIVE_CACHE_SIZE="$((MEM_MB * 3 / 8))MB"
}

compose_profiles() {
  profiles=''
  [ -n "${EXTERNAL_DATABASE_URL}" ] || profiles='db'
  [ -n "${NO_PROXY}" ] || profiles="${profiles:+${profiles},}proxy"
  [ -n "${NO_UPDATER}" ] || profiles="${profiles:+${profiles},}updater"
  printf '%s' "${profiles}"
}

new_env_file() {
  password=$(random_hex 24)
  TPL_PROFILES=$(compose_profiles)
  TPL_SECRET_KEY=$(random_base64 32)
  TPL_BACKUP_PASSPHRASE=$(random_base64 24 | tr -d '/+=')
  TPL_UPDATER_TOKEN=$(random_hex 32)
  TPL_METRICS_TOKEN=$(random_hex 32)
  export TPL_PROFILES TPL_SECRET_KEY TPL_BACKUP_PASSPHRASE TPL_UPDATER_TOKEN TPL_METRICS_TOKEN
  export TPL_VERSION="${VERSION}" TPL_CHANNEL="${CHANNEL}" TPL_DIR="${INSTALL_DIR}"
  export TPL_DOMAIN="${DOMAIN}" TPL_TLS_MODE="${TLS_MODE}"
  if [ -n "${NO_PROXY}" ]; then
    export TPL_PUBLIC_URL="http://${DOMAIN}:8080" TPL_HTTP_BIND='0.0.0.0:8080'
  else
    export TPL_PUBLIC_URL="https://${DOMAIN}" TPL_HTTP_BIND='127.0.0.1:8080'
  fi
  export TPL_POSTGRES_PASSWORD="${password}"
  export TPL_DATABASE_URL="${EXTERNAL_DATABASE_URL:-postgres://bemmoly:${password}@db:5432/bemmoly_db}"
  export TPL_PG_SHARED_BUFFERS="${PG_SHARED_BUFFERS}" TPL_PG_EFFECTIVE_CACHE_SIZE="${PG_EFFECTIVE_CACHE_SIZE}"
  if [ -n "${NO_UPDATER}" ]; then export TPL_UPDATER_URL=''; else export TPL_UPDATER_URL='http://updater:8090'; fi
  export TPL_MODULES="${MODULES}"
  if [ -n "${IMAGE_ARCHIVE}" ]; then export TPL_UPDATER_LOCAL_IMAGES=true; else export TPL_UPDATER_LOCAL_IMAGES=false; fi
  asset env.template | render_template | root_write "${INSTALL_DIR}/.env" 600
}

# A re-run keeps the secrets and changes only what the flags say.
update_env_file() {
  file="${INSTALL_DIR}/.env"
  tmp=$(mktemp)
  as_root cat "${file}" >"${tmp}"
  env_set "${tmp}" VERSION "${VERSION}"
  env_set "${tmp}" UPDATER_VERSION "${VERSION}"
  profiles=$(compose_profiles)
  # The optional PDF renderer is turned on by hand in .env; a re-run keeps it.
  case ",$(env_get "${tmp}" COMPOSE_PROFILES)," in
    *,pdf,*) profiles="${profiles:+${profiles},}pdf" ;;
  esac
  env_set "${tmp}" COMPOSE_PROFILES "${profiles}"
  env_set "${tmp}" BEMMOLY_UPDATE_CHANNEL "${CHANNEL}"
  [ -z "${MODULES}" ] || env_set "${tmp}" BEMMOLY_MODULES "${MODULES}"
  [ -z "${IMAGE_ARCHIVE}" ] || env_set "${tmp}" BEMMOLY_UPDATER_LOCAL_IMAGES true
  if [ -n "${DOMAIN_GIVEN:-}" ]; then
    env_set "${tmp}" BEMMOLY_DOMAIN "${DOMAIN}"
    env_set "${tmp}" BEMMOLY_TLS_MODE "${TLS_MODE}"
    [ -n "${NO_PROXY}" ] || env_set "${tmp}" BEMMOLY_PUBLIC_URL "https://${DOMAIN}"
  fi
  [ -n "$(env_get "${tmp}" BEMMOLY_METRICS_TOKEN)" ] || env_set "${tmp}" BEMMOLY_METRICS_TOKEN "$(random_hex 32)"
  root_write "${file}" 600 <"${tmp}"
  rm -f "${tmp}"
}

write_install_files() {
  as_root install -d -m 755 "${INSTALL_DIR}"
  # The app runs as uid 10001 inside its container; no such user exists on the host.
  as_root install -d -m 750 "${INSTALL_DIR}/data" "${INSTALL_DIR}/backups"
  as_root chown "${APP_UID}:${APP_UID}" "${INSTALL_DIR}/data" "${INSTALL_DIR}/backups"
  # The Postgres image's own user must traverse pg/; its entrypoint locks down the data folder.
  as_root install -d -m 755 "${INSTALL_DIR}/pg"
  as_root install -d -m 700 "${INSTALL_DIR}/caddy" "${INSTALL_DIR}/caddy/data" "${INSTALL_DIR}/caddy/config"
  asset docker-compose.yml | root_write "${INSTALL_DIR}/docker-compose.yml" 644
  asset Caddyfile | root_write "${INSTALL_DIR}/Caddyfile" 644
  if as_root test -f "${INSTALL_DIR}/.env"; then
    update_env_file
    note "Kept the existing ${INSTALL_DIR}/.env and its secrets"
  else
    new_env_file
  fi
}

configure() {
  [ -z "${DOMAIN}" ] || DOMAIN_GIVEN=1
  if as_root test -f "${INSTALL_DIR}/.env" && [ -z "${DOMAIN}" ]; then
    DOMAIN=$(as_root cat "${INSTALL_DIR}/.env" | env_get /dev/stdin BEMMOLY_DOMAIN)
  fi
  choose_domain
  dns_guide
  TLS_MODE=$(tls_mode_for "${DOMAIN}")
  tune_postgres
  write_install_files
}
