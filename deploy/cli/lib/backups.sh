# shellcheck shell=bash
# bemmoly: backup, backups, verify, restore (and --mount / --unmount).

# True when a complete backup set is younger than the given hours, read from the disk so
# the safety net works even when the app's database is down.
recent_backup_on_disk() {
  local hours="$1"
  find "${BEMMOLY_DIR}/backups" -mindepth 2 -maxdepth 2 -name manifest.json -mmin "-$((hours * 60))" 2>/dev/null | grep -q .
}

cmd_backup() {
  local args=(--kind manual)
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --if-older-than)
        [[ "${2:-}" =~ ^([0-9]+)h$ ]] || die "--if-older-than takes hours, e.g. 36h" ""
        if recent_backup_on_disk "${BASH_REMATCH[1]}"; then
          say "A backup younger than ${2} exists; nothing to do."
          return 0
        fi
        args+=(--if-older-than "$2")
        shift 2
        ;;
      --json) args+=(--json); shift ;;
      *) die "Unknown option for backup: $1" "Run: bemmoly backup [--if-older-than 36h]" ;;
    esac
  done
  in_app bemmoly-system backup "${args[@]}"
}

cmd_backups() {
  [[ "${1:-list}" == list ]] || die "Usage: bemmoly backups [list]" ""
  [[ $# -gt 0 ]] && shift
  in_app bemmoly-system backups "$@"
}

cmd_verify() {
  [[ $# -ge 1 ]] || die "Usage: bemmoly verify <backup> [--drill]" "List backups with: bemmoly backups"
  in_app bemmoly-system verify "$@"
}

# A backup handed over as a file or folder is copied into the backups folder first, where
# the app container can read it. Prints the set name.
import_backup() {
  local source="$1" target="${BEMMOLY_DIR}/backups" name
  if [[ -d "${source}" ]]; then
    [[ -f "${source}/manifest.json" ]] || die "${source} has no manifest.json" "Pass the backup's folder, e.g. ${target}/bemmoly-20261007-020000-scheduled-1a2b3c4d"
    name=$(basename "${source}")
    [[ "$(readlink -f "${source}")" == "$(readlink -f "${target}/${name}")" ]] || cp -a "${source}" "${target}/"
  elif [[ -f "${source}" ]]; then
    # A download from Settings › Storage and backups: a tar of one set's folder.
    name=$(tar -tf "${source}" | head -n 1 | cut -d/ -f1)
    [[ -n "${name}" ]] || die "${source} is not a backup download" "Download it again from Settings › Storage and backups."
    tar -xf "${source}" -C "${target}"
  else
    die "${source} does not exist" "Pass a backup name from \`bemmoly backups\`, a backup folder or file, or an s3:// URL."
  fi
  chown -R 10001:10001 "${target}/${name}"
  printf '%s' "${name}"
}

cmd_restore() {
  local mode=replace ref=''
  ASSUME_YES=''
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --mount) mode=mount; shift ;;
      --unmount) mode=unmount; shift ;;
      --yes | -y) ASSUME_YES=1; shift ;;
      *) ref="$1"; shift ;;
    esac
  done
  [[ -n "${ref}" ]] || die "Usage: bemmoly restore <backup|file|s3-url> [--yes] | --mount <backup> | --unmount <database>" "List backups with: bemmoly backups"
  case "${mode}" in
    unmount)
      in_app bemmoly-system unmount "${ref}"
      return 0
      ;;
  esac
  if [[ "${ref}" == /* || "${ref}" == ./* || -e "${ref}" ]]; then ref=$(import_backup "${ref}"); fi
  if [[ "${mode}" == mount ]]; then
    in_app bemmoly-system mount "${ref}"
    say ''
    say "Query it read-only with: sudo bemmoly shell db, then \\c <database above>"
    return 0
  fi
  say "Restoring ${ref} replaces everything in the live workspace with the backup."
  say 'The current database is kept for the retention window, and people see a maintenance page meanwhile.'
  confirm 'Restore now?'
  in_app bemmoly-system restore "${ref}"
  # A restart runs any changesets the backup's version did not have.
  compose restart bemmoly >>"${BEMMOLY_LOG}" 2>&1
  success "Restored ${ref}; Bemmoly restarted and applied any pending changesets"
}
