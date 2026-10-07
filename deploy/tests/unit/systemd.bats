#!/usr/bin/env bats
# The backup safety-net units the installer writes to /etc/systemd/system.

setup() {
  UNITS="$(cd "${BATS_TEST_DIRNAME}/../../installer/systemd" && pwd)"
}

# The ExecCondition= command line as systemd hands it to the shell ($$ becomes $).
condition() {
  sed -n "s/^ExecCondition=\/bin\/sh -c '\(.*\)'$/\1/p" "${UNITS}/bemmoly-backup.service" | sed 's/\$\$/$/g'
}

@test "the timer counts from its own start, not from boot" {
  grep -qx 'OnActiveSec=30min' "${UNITS}/bemmoly-backup.timer"
  ! grep -q '^OnBootSec=' "${UNITS}/bemmoly-backup.timer"
  ! grep -q '^Persistent=' "${UNITS}/bemmoly-backup.timer"
}

@test "the backup is skipped while the updater holds a fresh lock" {
  dir="${BATS_TEST_TMPDIR}/bemmoly"
  mkdir -p "${dir}/data/updater"
  [ -n "$(condition)" ]
  BEMMOLY_DIR="${dir}" sh -c "$(condition)"
  printf '1 2026-10-08T00:00:00Z\n' >"${dir}/data/updater/lock"
  run env BEMMOLY_DIR="${dir}" sh -c "$(condition)"
  [ "${status}" -eq 1 ]
  touch -t "$(date -v-3H +%Y%m%d%H%M 2>/dev/null || date -d '3 hours ago' +%Y%m%d%H%M)" \
    "${dir}/data/updater/lock"
  BEMMOLY_DIR="${dir}" sh -c "$(condition)"
}
