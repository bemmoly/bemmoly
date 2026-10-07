# shellcheck shell=bash
# bemmoly: status, doctor, logs, shell, start/stop/restart, config, update-channel.

env_file() { printf '%s/.env' "${BEMMOLY_DIR}"; }
env_value() { env_get "$(env_file)" "$1"; }

compose() {
  [[ -f "${BEMMOLY_DIR}/docker-compose.yml" ]] ||
    die "No Bemmoly install in ${BEMMOLY_DIR}" "Install it with: curl -fsSL https://get.bemmoly.com | sh (or set BEMMOLY_DIR)."
  docker compose --project-directory "${BEMMOLY_DIR}" "$@"
}

# The updater holds this file for a whole update or rollback. Its swapped-out container
# keeps the Compose labels, so `compose up|stop|restart` would act on it too, and a
# restore or backup would race the swap. Two hours old, it is a crash's leftover.
updater_lock_held() {
  [[ -n "$(find "${BEMMOLY_DIR}/data/updater/lock" -mmin -120 2>/dev/null)" ]]
}

refuse_during_update() {
  updater_lock_held || return 0
  die "An update or rollback is in progress; bemmoly $1 would interfere with it" \
    "Wait until it finishes (sudo bemmoly status shows the app again), then run the command again."
}

app_running() {
  [[ "$(docker inspect --format '{{.State.Running}}' bemmoly-bemmoly-1 2>/dev/null)" == true ]]
}

# Runs a command inside the app container (bemmoly-system, bemmoly-db).
in_app() {
  app_running || die "The bemmoly container is not running" "Start it with: sudo bemmoly start, then see: sudo bemmoly logs bemmoly"
  compose exec -T bemmoly "$@"
}

confirm() {
  if [[ -n "${ASSUME_YES:-}" ]]; then return 0; fi
  [[ -r /dev/tty ]] || die "$1 needs a confirmation" "Re-run with --yes to confirm without a prompt."
  local answer
  read -r -p "$1 [y/N] " answer </dev/tty
  [[ "${answer}" == y || "${answer}" == Y || "${answer}" == yes ]] || die "Cancelled" ""
}

certificate_line() {
  local domain
  domain=$(env_value BEMMOLY_DOMAIN)
  [[ -n "${domain}" && ",$(env_value COMPOSE_PROFILES)," == *",proxy,"* ]] || return 0
  local details
  details=$(openssl s_client -connect 127.0.0.1:443 -servername "${domain}" </dev/null 2>/dev/null |
    openssl x509 -noout -enddate -issuer 2>/dev/null) || {
    say "certificate: not served yet for ${domain}"
    return 0
  }
  local expires issuer
  expires=$(sed -n 's/^notAfter=//p' <<<"${details}")
  issuer=$(sed -n 's/^issuer=//p' <<<"${details}")
  say "certificate: ${domain}, expires ${expires} (${issuer})"
}

cmd_status() {
  compose ps --format 'table {{.Service}}\t{{.State}}\t{{.Status}}'
  say ''
  if app_running; then in_app bemmoly-system status; else warn "the bemmoly container is not running"; fi
  certificate_line
}

# A self-signed install whose domain now resolves: Caddy has a real certificate; say so.
refresh_tls_mode() {
  [[ "$(env_value BEMMOLY_TLS_MODE)" == internal ]] || return 0
  local domain issuer
  domain=$(env_value BEMMOLY_DOMAIN)
  issuer=$(openssl s_client -connect 127.0.0.1:443 -servername "${domain}" </dev/null 2>/dev/null |
    openssl x509 -noout -issuer 2>/dev/null || true)
  if [[ -n "${issuer}" && "${issuer}" != *"Caddy Local Authority"* ]]; then
    env_set "$(env_file)" BEMMOLY_TLS_MODE auto
    compose up -d proxy >>"${BEMMOLY_LOG}" 2>&1
    success "${domain} now has a real certificate; HTTPS mode set to auto"
  fi
}

cmd_doctor() {
  local failed=0 check
  say 'Machine'
  detect_os
  detect_resources
  note "$(describe_machine)"
  for check in check_memory "check_disk ${BEMMOLY_DIR}" check_dns; do
    # Each check prints its own fix and fails only its subshell.
    # shellcheck disable=SC2086
    if (${check}) 2>&1; then success "${check#check_}"; else failed=1; fi
  done
  if ! systemctl is-active --quiet docker 2>/dev/null; then
    warn 'Docker is not running. Fix: sudo systemctl start docker'
    failed=1
  fi
  say ''
  say 'Bemmoly'
  if app_running; then
    in_app bemmoly-system health --tls "$(env_value BEMMOLY_TLS_MODE)" || failed=1
    refresh_tls_mode
  else
    warn 'The bemmoly container is not running. Fix: sudo bemmoly start; then sudo bemmoly logs bemmoly'
    failed=1
  fi
  certificate_line
  return "${failed}"
}

cmd_logs() {
  local follow=() service=()
  for arg in "$@"; do
    if [[ "${arg}" == -f || "${arg}" == --follow ]]; then follow=(--follow); else service+=("${arg}"); fi
  done
  compose logs --tail 200 "${follow[@]}" "${service[@]}"
}

cmd_shell() {
  case "${1:-bemmoly}" in
    db) compose exec db psql -U bemmoly -d bemmoly_db ;;
    *) compose exec "${1:-bemmoly}" sh ;;
  esac
}

cmd_lifecycle() {
  refuse_during_update "$1"
  case "$1" in
    start) compose up -d ;;
    stop) compose stop ;;
    restart) compose restart ;;
  esac
}

SECRET_KEYS='BEMMOLY_SECRET_KEY|BEMMOLY_BACKUP_PASSPHRASE|POSTGRES_PASSWORD|UPDATER_TOKEN|BEMMOLY_METRICS_TOKEN|DATABASE_URL'

cmd_config() {
  local action="${1:-}" key="${2:-}"
  [[ "${key}" =~ ^[A-Z][A-Z0-9_]*$ ]] || die "A setting name looks like LOG_LEVEL" "Run: bemmoly config get LOG_LEVEL"
  case "${action}" in
    get)
      if [[ "${key}" =~ ^(${SECRET_KEYS})$ ]]; then say "${key}=(set, hidden)"; else say "${key}=$(env_value "${key}")"; fi
      ;;
    set)
      [[ $# -ge 3 ]] || die "config set needs a value" "Run: bemmoly config set ${key} VALUE"
      refuse_during_update 'config set'
      if [[ "${key}" == BEMMOLY_SECRET_KEY || "${key}" == POSTGRES_PASSWORD ]]; then
        die "${key} cannot be changed here" "Changing it would lock you out of stored credentials or the database; see https://bemmoly.com/docs/rotate-secrets"
      fi
      cp "$(env_file)" "$(env_file).bak"
      env_set "$(env_file)" "${key}" "$3"
      compose up -d >>"${BEMMOLY_LOG}" 2>&1 || die "The stack did not restart with the new value" "The previous file is ${BEMMOLY_DIR}/.env.bak"
      success "${key} updated; services that use it were restarted"
      ;;
    *) die "Usage: bemmoly config get KEY | config set KEY VALUE" "" ;;
  esac
}

cmd_update_channel() {
  if [[ $# -eq 0 ]]; then
    say "Update channel: $(env_value BEMMOLY_UPDATE_CHANNEL)"
    return 0
  fi
  [[ "$1" == stable || "$1" == beta ]] || die "The channel is stable or beta" "Run: bemmoly update-channel beta"
  env_set "$(env_file)" BEMMOLY_UPDATE_CHANNEL "$1"
  success "Update channel set to $1; \`bemmoly upgrade\` without a version follows it"
}
