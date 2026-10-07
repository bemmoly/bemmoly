# shellcheck shell=bash
# bemmoly: upgrade, rollback, db. Upgrades and rollbacks run the updater's own code in a
# one-off container, so installs without the in-app updater follow the same steps.

updater_image() {
  printf '%s:%s' "$(env_value UPDATER_IMAGE || true)" "$(env_value UPDATER_VERSION)" |
    sed 's|^:|ghcr.io/bemmoly/updater:|'
}

run_updater() {
  local network
  network=$(docker inspect --format '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}} {{end}}' bemmoly-bemmoly-1 2>/dev/null | awk '{ print $1 }')
  [[ -n "${network}" ]] || die "The bemmoly container is not running" "Start it with: sudo bemmoly start"
  docker run --rm --init --network "${network}" \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v "${BEMMOLY_DIR}:${BEMMOLY_DIR}" \
    -e UPDATER_TOKEN="$(env_value UPDATER_TOKEN)" \
    -e BEMMOLY_DIR="${BEMMOLY_DIR}" \
    -e BEMMOLY_IMAGE="$(env_value BEMMOLY_IMAGE)" \
    -e BEMMOLY_ALLOW_UNSIGNED_UPDATES="$(env_value BEMMOLY_ALLOW_UNSIGNED_UPDATES)" \
    -e BEMMOLY_UPDATER_LOCAL_IMAGES="$(env_value BEMMOLY_UPDATER_LOCAL_IMAGES)" \
    "$(updater_image)" updater-cli "$@"
}

# Prints one dotted field of a JSON document on stdin, parsed by Node in the app container.
json_field() {
  # shellcheck disable=SC2016
  compose exec -T bemmoly node -e '
    let text = "";
    process.stdin.on("data", (chunk) => (text += chunk)).on("end", () => {
      let value = JSON.parse(text);
      for (const key of process.argv[1].split(".")) value = value == null ? value : value[key];
      process.stdout.write(value == null ? "" : String(value));
    });' "$1"
}

latest_available() {
  in_app bemmoly-system update-check --json >/dev/null 2>&1 || true
  in_app bemmoly-system updates --json 2>/dev/null | json_field available.version
}

cmd_upgrade() {
  local version=''
  ASSUME_YES=''
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --yes | -y) ASSUME_YES=1; shift ;;
      *) version="${1#v}"; shift ;;
    esac
  done
  if [[ -z "${version}" ]]; then
    version=$(latest_available)
    [[ -n "${version}" ]] || die "No newer version is available on the $(env_value BEMMOLY_UPDATE_CHANNEL) channel" \
      "Pass one explicitly: sudo bemmoly upgrade 1.2.0"
  fi
  semver_ok "${version}" || die "${version} is not a version" "Pass one like 1.2.0"
  say "Upgrading Bemmoly $(env_value VERSION) → ${version}: backup, pull, verify, swap, health check."
  say 'If the new version does not become ready within 3 minutes, the previous one is restored automatically.'
  confirm 'Upgrade now?'
  run_updater upgrade "${version}"
  # The updater container follows the app; a failed pull keeps the one installed.
  if [[ "$(env_value VERSION)" == "${version}" ]]; then
    env_set "$(env_file)" UPDATER_VERSION "${version}"
    if ! compose pull --policy missing updater >>"${BEMMOLY_LOG}" 2>&1; then
      env_set "$(env_file)" UPDATER_VERSION "$(docker inspect --format '{{index .Config.Labels "org.opencontainers.image.version"}}' bemmoly-updater-1 2>/dev/null || env_value VERSION)"
    fi
    compose up -d >>"${BEMMOLY_LOG}" 2>&1 || true
    success "Bemmoly ${version} is running"
  fi
}

cmd_rollback() {
  local args=() expect=''
  ASSUME_YES=''
  for arg in "$@"; do
    case "${arg}" in
      --yes | -y) ASSUME_YES=1 ;;
      --prefer-restore) args+=(--prefer-restore) ;;
      *) die "Unknown option for rollback: ${arg}" "Run: bemmoly rollback [--prefer-restore] [--yes]" ;;
    esac
  done
  local plan
  plan=$(in_app bemmoly-system rollback-plan --json "${args[@]}")
  expect=$(json_field mode <<<"${plan}")
  local summary
  summary=$(json_field summary <<<"${plan}")
  [[ -n "${expect}" ]] || die "${summary:-There is nothing to roll back}" "Rollback is available for 7 days after an update."
  say "Rollback mode: ${expect}"
  say "${summary}"
  confirm 'Roll back now?'
  run_updater rollback --expect "${expect}" "${args[@]}"
  success "Rolled back; Bemmoly $(env_value VERSION) is running"
}

cmd_db() {
  [[ $# -ge 1 ]] || die "Usage: bemmoly db <status|validate|plan|history|tag NAME>" ""
  in_app bemmoly-db "$@"
}
