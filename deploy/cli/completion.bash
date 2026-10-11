# shellcheck shell=bash
# Bash completion for the bemmoly command.

_bemmoly_backups() {
  find /var/bemmoly/backups -mindepth 1 -maxdepth 1 -type d -name 'bemmoly-*' -printf '%f\n' 2>/dev/null
}

_bemmoly() {
  local current previous
  current="${COMP_WORDS[COMP_CWORD]}"
  previous="${COMP_WORDS[COMP_CWORD - 1]}"
  local commands='status doctor logs shell start stop restart config settings domain backup backups verify restore upgrade rollback sync-updater self-update version db update-channel help'
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
    settings)
      if [[ "${COMP_CWORD}" -eq 2 ]]; then
        mapfile -t COMPREPLY < <(compgen -W 'import' -- "${current}")
      else
        mapfile -t COMPREPLY < <(compgen -f -- "${current}")
      fi
      ;;
    domain) [[ "${COMP_CWORD}" -eq 2 ]] && mapfile -t COMPREPLY < <(compgen -W 'set' -- "${current}") ;;
    backup) mapfile -t COMPREPLY < <(compgen -W '--if-older-than' -- "${current}") ;;
    verify | restore)
      if [[ "${previous}" == --unmount ]]; then return; fi
      mapfile -t COMPREPLY < <(compgen -W "$(_bemmoly_backups) --mount --unmount --drill --yes" -- "${current}")
      ;;
    upgrade)
      if [[ "${previous}" == --bundle || "${previous}" == --trusted-root ]]; then
        mapfile -t COMPREPLY < <(compgen -f -- "${current}")
      else
        mapfile -t COMPREPLY < <(compgen -W '--bundle --trusted-root --skip-signature-check --yes' -- "${current}")
      fi
      ;;
    rollback) mapfile -t COMPREPLY < <(compgen -W '--prefer-restore --yes' -- "${current}") ;;
    db) mapfile -t COMPREPLY < <(compgen -W 'status validate plan history tag rollback' -- "${current}") ;;
    self-update) mapfile -t COMPREPLY < <(compgen -W '--from' -- "${current}") ;;
    update-channel) mapfile -t COMPREPLY < <(compgen -W 'stable beta' -- "${current}") ;;
  esac
}

complete -F _bemmoly bemmoly
