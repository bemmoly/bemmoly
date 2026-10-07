#!/bin/sh
# ShellCheck every shell file under deploy/, and hold them to the 300-line limit that
# ESLint enforces for TypeScript. POSIX files are checked as sh, the CLI as bash.
set -eu

DEPLOY_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "${DEPLOY_DIR}"

# One ShellCheck release and severity everywhere. Releases disagree (0.9.0 on CI runners
# reports SC2015 where 0.11.0 does not), so a lint that passed locally failed in CI.
# With another release installed, the pinned image runs instead.
SHELLCHECK_VERSION=0.11.0
SHELLCHECK_IMAGE=koalaman/shellcheck:v0.11.0@sha256:61862eba1fcf09a484ebcc6feea46f1782532571a34ed51fedf90dd25f925a8d
SHELLCHECK_SEVERITY=style

installed_version() {
  shellcheck --version 2>/dev/null | awk '/^version:/ { print $2 }'
}

if command -v shellcheck >/dev/null 2>&1 && [ "$(installed_version)" = "${SHELLCHECK_VERSION}" ]; then
  run_shellcheck() { shellcheck --severity="${SHELLCHECK_SEVERITY}" "$@"; }
elif command -v docker >/dev/null 2>&1; then
  run_shellcheck() {
    docker run --rm -v "${DEPLOY_DIR}:${DEPLOY_DIR}" -w "${DEPLOY_DIR}" "${SHELLCHECK_IMAGE}" \
      --severity="${SHELLCHECK_SEVERITY}" "$@"
  }
else
  echo "lint-shell: needs ShellCheck ${SHELLCHECK_VERSION} (found: $(installed_version || true)) or Docker for ${SHELLCHECK_IMAGE}" >&2
  exit 1
fi

posix="install.sh $(find installer scripts docker/bin updater/bin tests/smoke -type f \( -name '*.sh' -o -path '*/bin/*' \) 2>/dev/null | sort | tr '\n' ' ')"
bash_files="cli/bemmoly $(find cli/lib -name '*.sh' | sort | tr '\n' ' ') cli/completion.bash"

status=0
# shellcheck disable=SC2086 # word splitting of the file lists is intended
run_shellcheck --shell=sh ${posix} || status=1
# shellcheck disable=SC2086
run_shellcheck --shell=bash ${bash_files} || status=1

for file in ${posix} ${bash_files} $(find tests -name '*.bats' 2>/dev/null); do
  lines=$(wc -l <"${file}")
  if [ "${lines}" -gt 300 ]; then
    echo "lint-shell: ${file} has ${lines} lines; the limit is 300. Split it into sourced files." >&2
    status=1
  fi
done
exit "${status}"
