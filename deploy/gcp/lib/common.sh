# shellcheck shell=sh
# Output and the gcloud wrappers the Google Cloud bootstrap uses. POSIX sh.
#
# Every gcloud call is printed before it runs, so whoever runs this in Cloud Shell sees
# exactly what changes in their organisation. Reads run even in a dry run: they change
# nothing, and they let the plan skip what already exists. Changes only print.

say() { printf '%s\n' "$*"; }
note() { printf '→ %s\n' "$*"; }
skip() { printf '✓ %s\n' "$*"; }
warn() { printf '! %s\n' "$*" >&2; }
have() { command -v "$1" >/dev/null 2>&1; }

# die "what went wrong" "what to do next"
die() {
  printf '\n✗ %s\n' "$1" >&2
  if [ -n "${2:-}" ]; then printf '  Fix: %s\n' "$2" >&2; fi
  exit 1
}

# has_line LIST ITEM  succeeds when ITEM is one of the lines of LIST.
has_line() { printf '%s\n' "$1" | grep -qxF -- "$2"; }

# Prints the arguments as one shell line, single-quoting what needs it, so a printed
# command can be pasted back into the shell as it is.
quote_cmd() {
  qc_line=''
  for qc_arg in "$@"; do
    case "${qc_arg}" in
      '' | *[!A-Za-z0-9_./:=@,%+-]*) qc_arg="'$(printf '%s' "${qc_arg}" | sed "s/'/'\\\\''/g")'" ;;
    esac
    qc_line="${qc_line:+${qc_line} }${qc_arg}"
  done
  printf '%s\n' "${qc_line}"
}

# Traces go to fd 3, a copy of stderr made at start, so a read whose own errors are hidden
# (2>/dev/null) is still printed.
trace() { printf '+ gcloud %s\n' "$(quote_cmd "$@")" >&3; }

# gc ARGS…  a read: printed, then run. Its output is the caller's; errors stay visible.
gc() {
  trace "$@"
  gcloud "$@"
}

# gc_exists ARGS…  a describe whose failure means "not there yet". gcloud reports a missing
# resource and one we may not see the same way, so its error is hidden and the create that
# follows says what is wrong if it is the latter.
gc_exists() {
  trace "$@"
  gcloud "$@" >/dev/null 2>&1
}

# gc_change FIX ARGS…  a change: printed and skipped in a dry run, otherwise run. A failure
# stops the bootstrap with FIX as the next step; gcloud's own message is printed above it.
gc_change() {
  gcc_fix="$1"
  shift
  if [ -n "${DRY_RUN}" ]; then
    printf '  [dry run] gcloud %s\n' "$(quote_cmd "$@")" >&2
    return 0
  fi
  trace "$@"
  gcloud "$@" >/dev/null || die "gcloud $1 $2 failed (its message is above)" "${gcc_fix}"
}

# A yes before the first change. Works under `curl | sh`, where stdin is the script.
confirm() {
  if [ -n "${DRY_RUN}${ASSUME_YES}" ]; then return 0; fi
  if ! (: </dev/tty) 2>/dev/null; then
    die 'Nothing was changed: there is no terminal to confirm on' \
      'Run again with --yes, or with --dry-run to see the plan first.'
  fi
  printf '%s [y/N] ' "$1" >/dev/tty
  IFS= read -r cf_answer </dev/tty || cf_answer=''
  case "${cf_answer}" in
    y | Y | yes | Yes) ;;
    *) die 'Stopped; nothing was changed' 'Run again and answer y, or pass --yes.' ;;
  esac
}
