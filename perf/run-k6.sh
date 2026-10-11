#!/usr/bin/env bash
# Runs one k6 script from perf/k6 in the pinned k6 image against an install.
#
#   BASE_URL=https://bemmoly.example.com CREDENTIALS=… DATASET=… OUT_DIR=… \
#     bash perf/run-k6.sh board.js [extra k6 run arguments]
#
# The scripts, the credentials file and the dataset manifest are copied into the container
# rather than mounted, so it works the same with Docker Desktop, Colima (which mounts only the
# home directory) and CI. The end-of-test summary lands in OUT_DIR/<script>.summary.json.
# Knobs the scripts read (RATE, DURATION, WARMUP, PAGE_RATE, PAIRS, SESSION_SECONDS, KEY_MS)
# pass through from the environment. K6_NETWORK=host for an install on the runner itself,
# K6_CPUSET (e.g. 2,3) to pin k6 to CPUs the install does not use.
set -euo pipefail

K6_IMAGE="${K6_IMAGE:-grafana/k6:2.3.0@sha256:9c2dee7f8ed74d317e4027c06a10f169b625638189de8d4555d0b3486a5aeb34}"
script="${1:?usage: run-k6.sh <script.js> [k6 args]}"
shift
: "${BASE_URL:?set BASE_URL to the install, e.g. https://bemmoly.example.com}"
: "${CREDENTIALS:?set CREDENTIALS to the file perf/src/provision.ts wrote}"
: "${DATASET:?set DATASET to the manifest perf/src/seed.ts wrote}"
OUT_DIR="${OUT_DIR:-$(pwd)/perf-results}"

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
stage="$(mktemp -d)"
name="bemmoly-k6-$$-${RANDOM}"
# shellcheck disable=SC2329 # run by the EXIT trap
cleanup() {
  docker rm -f "${name}" > /dev/null 2>&1 || true
  rm -rf "${stage}"
}
trap cleanup EXIT

mkdir -p "${stage}/load/out" "${OUT_DIR}"
cp "${CREDENTIALS}" "${stage}/load/credentials.json"
cp "${DATASET}" "${stage}/load/dataset.json"

env_args=()
for key in RATE DURATION WARMUP PAGE_RATE PAIRS SESSION_SECONDS KEY_MS DEBUG; do
  if [[ -n "${!key:-}" ]]; then env_args+=(-e "${key}=${!key}"); fi
done

# K6_CPUSET keeps k6 off the CPUs the install under test runs on (CI pins both).
if [[ -n "${K6_CPUSET:-}" ]]; then env_args+=(--cpuset-cpus "${K6_CPUSET}"); fi

docker create --name "${name}" --user root --network "${K6_NETWORK:-bridge}" \
  -e "BASE_URL=${BASE_URL}" -e CREDENTIALS=/load/credentials.json -e DATASET=/load/dataset.json \
  ${env_args[@]+"${env_args[@]}"} "${K6_IMAGE}" run \
  --summary-export "/load/out/${script%.js}.summary.json" "/scripts/${script}" "$@" > /dev/null
docker cp "${stage}/load" "${name}:/load"
docker cp "${here}/k6" "${name}:/scripts"

status=0
docker start --attach "${name}" || status=$?
docker cp "${name}:/load/out/." "${OUT_DIR}/" > /dev/null 2>&1 || true
exit "${status}"
