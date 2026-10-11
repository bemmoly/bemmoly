# shellcheck shell=bash
# bemmoly tune, and the Postgres tuning check bemmoly doctor runs.

# The bundled Postgres only: an external database is tuned by whoever runs it.
bundled_postgres() { [[ ",$(env_value COMPOSE_PROFILES)," == *",db,"* ]]; }

# The number of megabytes in a setting such as 512MB or 1GB; empty when it is not one.
setting_mb() {
  case "$1" in
    *GB) printf '%s' "$((${1%GB} * 1024))" ;;
    *MB) printf '%s' "${1%MB}" ;;
  esac
}

# Apart by more than a tenth: memory reported a few MB short is not a resize.
settings_differ() {
  local applied wanted
  applied=$(setting_mb "$1")
  wanted=$(setting_mb "$2")
  [[ "${applied}" =~ ^[0-9]+$ && "${wanted}" =~ ^[0-9]+$ ]] || return 0
  ((applied * 10 < wanted * 9 || applied * 10 > wanted * 11))
}

# After a resize the database keeps the settings the installer wrote for the old machine.
# Needs MEM_MB and CPU_COUNT (detect_resources).
check_postgres_tuning() {
  bundled_postgres || return 0
  local applied_buffers applied_cache
  applied_buffers=$(env_value PG_SHARED_BUFFERS)
  applied_cache=$(env_value PG_EFFECTIVE_CACHE_SIZE)
  tune_postgres
  if settings_differ "${applied_buffers:-512MB}" "${PG_SHARED_BUFFERS}" ||
    settings_differ "${applied_cache:-1536MB}" "${PG_EFFECTIVE_CACHE_SIZE}"; then
    warn "Postgres is tuned for another machine size: shared_buffers ${applied_buffers:-512MB}, effective_cache_size ${applied_cache:-1536MB}; this machine (${CPU_COUNT} vCPU, ${MEM_MB} MB) wants ${PG_SHARED_BUFFERS} and ${PG_EFFECTIVE_CACHE_SIZE}. Fix: sudo bemmoly tune"
    return 1
  fi
}

# bemmoly tune [--yes]: re-applies the installer's Postgres tuning for this machine's memory,
# keeps the previous .env as .env.bak, and restarts only the database when you say so.
cmd_tune() {
  ASSUME_YES=''
  for arg in "$@"; do
    case "${arg}" in
      --yes | -y) ASSUME_YES=1 ;;
      *) die "Unknown option for tune: ${arg}" "Run: bemmoly tune [--yes]" ;;
    esac
  done
  bundled_postgres || die "This install uses an external database" "Tune it where it runs; bemmoly tunes only the bundled Postgres."
  refuse_during_update tune
  detect_resources
  local old_buffers old_cache
  old_buffers=$(env_value PG_SHARED_BUFFERS)
  old_cache=$(env_value PG_EFFECTIVE_CACHE_SIZE)
  tune_postgres
  if [[ "${old_buffers}" == "${PG_SHARED_BUFFERS}" && "${old_cache}" == "${PG_EFFECTIVE_CACHE_SIZE}" ]]; then
    success "Postgres is already tuned for ${MEM_MB} MB (${PG_SHARED_BUFFERS}, ${PG_EFFECTIVE_CACHE_SIZE})"
    return 0
  fi
  say "This machine: ${CPU_COUNT} vCPU, ${MEM_MB} MB"
  say "shared_buffers ${old_buffers:-512MB} → ${PG_SHARED_BUFFERS}"
  say "effective_cache_size ${old_cache:-1536MB} → ${PG_EFFECTIVE_CACHE_SIZE}"
  cp "$(env_file)" "$(env_file).bak"
  env_set "$(env_file)" PG_SHARED_BUFFERS "${PG_SHARED_BUFFERS}"
  env_set "$(env_file)" PG_EFFECTIVE_CACHE_SIZE "${PG_EFFECTIVE_CACHE_SIZE}"
  success "Saved to ${BEMMOLY_DIR}/.env (the previous file is .env.bak)"
  if restart_database_now; then
    compose up -d --no-deps db >>"${BEMMOLY_LOG}" 2>&1 ||
      die "The database did not restart with the new settings" "Put back ${BEMMOLY_DIR}/.env.bak and run: sudo bemmoly start"
    success "The database restarted with the new settings"
  else
    say "The database keeps its settings until it restarts. Apply them with: sudo bemmoly restart"
  fi
}

# Restarting Postgres drops every connection for a few seconds; ask unless --yes.
restart_database_now() {
  [[ -n "${ASSUME_YES:-}" ]] && return 0
  [[ -r /dev/tty ]] || return 1
  local answer
  read -r -p "Restart the database now? The app pauses for a few seconds. [y/N] " answer </dev/tty
  [[ "${answer}" == y || "${answer}" == Y || "${answer}" == yes ]]
}
