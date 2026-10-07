# shellcheck shell=bash
# Bash completion for the bemmoly command.

_bemmoly_backups() {
  find /var/bemmoly/backups -mindepth 1 -maxdepth 1 -type d -name 'bemmoly-*' -printf '%f\n' 2>/dev/null
}

_bemmoly() {
  local current previous
  current="${COMP_WORDS[COMP_CWORD]}"
  previous="${COMP_WORDS[COMP_CWORD - 1]}"
  local commands='status doctor logs shell start stop restart config backup backups verify restore upgrade rollback db update-channel help'
  if [[ "${COMP_CWORD}" -eq 1 ]]; then
    mapfile -t COMPREPLY < <(compgen -W "${commands}" -- "${current}")
    return
  fi
  case "${COMP_WORDS[1]}" in
    logs | shell) mapfile -t COMPREPLY < <(compgen -W 'bemmoly db proxy updater -f' -- "${current}") ;;
    config)
      if [[ "${COMP_CWORD}" -eq 2 ]]; then
        mapfile -t COMPREPLY < <(compgen -W 'get set' -- "${current}")
      else
        mapfile -t COMPREPLY < <(compgen -W "$(sed -n 's/=.*//p' /var/bemmoly/.env 2>/dev/null)" -- "${current}")
      fi
      ;;
    backup) mapfile -t COMPREPLY < <(compgen -W '--if-older-than' -- "${current}") ;;
    verify | restore)
      if [[ "${previous}" == --unmount ]]; then return; fi
      mapfile -t COMPREPLY < <(compgen -W "$(_bemmoly_backups) --mount --unmount --drill --yes" -- "${current}")
      ;;
    rollback) mapfile -t COMPREPLY < <(compgen -W '--prefer-restore --yes' -- "${current}") ;;
    db) mapfile -t COMPREPLY < <(compgen -W 'status validate plan history tag rollback' -- "${current}") ;;
    update-channel) mapfile -t COMPREPLY < <(compgen -W 'stable beta' -- "${current}") ;;
  esac
}

complete -F _bemmoly bemmoly
