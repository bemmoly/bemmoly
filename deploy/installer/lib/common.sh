# shellcheck shell=sh
# Output and small helpers shared by the installer and the bemmoly CLI. POSIX sh.
#
# Progress reads like the landing page: one "→ … done" line per step, and every
# failure says what to do next instead of printing a stack trace.

BEMMOLY_LOG="${BEMMOLY_LOG:-/tmp/bemmoly-install.log}"

say() { printf '%s\n' "$*"; }
note() { printf '→ %s\n' "$*"; }
success() { printf '✓ %s\n' "$*"; }
warn() { printf '! %s\n' "$*" >&2; }

# step "Installing Docker"; …; step_done   prints "→ Installing Docker … done"
step() { printf '→ %s … ' "$1"; }
step_done() { printf '%s\n' "${1:-done}"; }

# die "what went wrong" "how to fix it"
die() {
  printf '\n✗ %s\n' "$1" >&2
  if [ -n "${2:-}" ]; then printf '  Fix: %s\n' "$2" >&2; fi
  if [ -s "${BEMMOLY_LOG}" ]; then printf '  Details: %s\n' "${BEMMOLY_LOG}" >&2; fi
  exit 1
}

# Runs a command with its output in the log; returns its status.
quietly() {
  printf '\n$ %s\n' "$*" >>"${BEMMOLY_LOG}"
  "$@" >>"${BEMMOLY_LOG}" 2>&1
}

have() { command -v "$1" >/dev/null 2>&1; }

# Privileged commands: as is when root, through sudo otherwise.
as_root() {
  if [ "$(id -u)" -eq 0 ]; then "$@"; else sudo "$@"; fi
}

# A prompt that works under `curl | sh`, where stdin is the script itself.
ask() {
  printf '%s' "$1" >/dev/tty
  IFS= read -r answer </dev/tty || answer=''
  printf '%s' "${answer}"
}

interactive() { [ -z "${ASSUME_YES:-}" ] && [ -r /dev/tty ] && [ -w /dev/tty ]; }

# Random secrets from the kernel; base64 for keys, hex for tokens and passwords.
random_base64() { head -c "$1" /dev/urandom | base64 | tr -d '\n'; }
random_hex() { od -An -tx1 -N"$1" /dev/urandom | tr -d ' \n'; }

# env_get FILE KEY        prints the value of KEY in a .env file
env_get() {
  sed -n "s/^$2=//p" "$1" 2>/dev/null | tail -n 1
}

# env_set FILE KEY VALUE  replaces or appends KEY=VALUE, keeping mode 600
env_set() {
  if grep -q "^$2=" "$1" 2>/dev/null; then
    tmp="$1.tmp.$$"
    awk -v key="$2" -v value="$3" 'BEGIN { FS = OFS = "=" }
      $1 == key { print key "=" value; next } { print }' "$1" >"${tmp}"
    chmod 600 "${tmp}"
    mv "${tmp}" "$1"
  else
    printf '%s=%s\n' "$2" "$3" >>"$1"
  fi
}

# Replaces @NAME@ placeholders on stdin with the values of the named variables.
render_template() {
  awk '{
    while (match($0, /@[A-Z_]+@/)) {
      name = substr($0, RSTART + 1, RLENGTH - 2)
      $0 = substr($0, 1, RSTART - 1) ENVIRON["TPL_" name] substr($0, RSTART + RLENGTH)
    }
    print
  }'
}

semver_ok() {
  printf '%s' "$1" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$'
}
