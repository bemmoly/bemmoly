#!/bin/sh
# ShellCheck every shell file under deploy/, and hold them to the 300-line limit that
# ESLint enforces for TypeScript. POSIX files are checked as sh, the CLI as bash.
set -eu

DEPLOY_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "${DEPLOY_DIR}"

if ! command -v shellcheck >/dev/null 2>&1; then
  echo "lint-shell: shellcheck is not installed (apt-get install shellcheck, brew install shellcheck)" >&2
  exit 1
fi

posix="install.sh $(find installer scripts docker/bin updater/bin tests/smoke -type f \( -name '*.sh' -o -path '*/bin/*' \) 2>/dev/null | sort | tr '\n' ' ')"
bash_files="cli/bemmoly $(find cli/lib -name '*.sh' | sort | tr '\n' ' ') cli/completion.bash"

status=0
# shellcheck disable=SC2086 # word splitting of the file lists is intended
shellcheck -s sh ${posix} || status=1
# shellcheck disable=SC2086
shellcheck -s bash ${bash_files} || status=1

for file in ${posix} ${bash_files} $(find tests -name '*.bats' 2>/dev/null); do
  lines=$(wc -l <"${file}")
  if [ "${lines}" -gt 300 ]; then
    echo "lint-shell: ${file} has ${lines} lines; the limit is 300. Split it into sourced files." >&2
    status=1
  fi
done
exit "${status}"
