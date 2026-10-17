#!/usr/bin/env bash
# The concurrency ramp: the mixed workload held for STEP_DURATION at each rate in turn, with
# the soak monitor sampling the server throughout, so each step has server-side p95/p99 per
# route, error rate, CPU, memory, pool use and queue depth (perf/src/capacity.ts reads it).
#
#   BASE_URL=… CREDENTIALS=… DATASET=… METRICS_CMD=… OUT_DIR=ramp-A \
#     bash perf/run-ramp.sh 40 80 160 320 640
#
# Page opens scale with the rate (one a second per 40 actions) and so do the pairs typing
# (one per 40 actions, at least 3). STOP_ERROR_RATE (default 0.01) ends the ramp after a
# step whose failed-request rate is above it. Optional DB_CMD and STATS_CMD go to the monitor,
# and HOST_LOAD_CMD (default: the 1-minute load average here; it may add the host's CPU idle
# percent as a second field) is sampled every 10 s.
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
: "${METRICS_CMD:?set METRICS_CMD to a command that prints the /metrics of the install}"
OUT_DIR="${OUT_DIR:-$(pwd)/ramp}"
STEP_DURATION="${STEP_DURATION:-5m}"
STOP_ERROR_RATE="${STOP_ERROR_RATE:-0.01}"
HOST_LOAD_CMD="${HOST_LOAD_CMD:-uptime | sed -E 's/.*load averages?: *([0-9.]+).*/\1/'}"
mkdir -p "${OUT_DIR}"
# One monitor file per invocation, so re-running a step keeps the earlier samples.
run_id="$(date -u +%H%M%S)"

monitor_args=(--metrics-cmd "${METRICS_CMD}" --interval 15)
[[ -n "${DB_CMD:-}" ]] && monitor_args+=(--db-cmd "${DB_CMD}")
[[ -n "${STATS_CMD:-}" ]] && monitor_args+=(--stats-cmd "${STATS_CMD}")
node "${here}/src/soak/monitor.ts" "${monitor_args[@]}" \
  --out "${OUT_DIR}/monitor-${run_id}.jsonl" --summary "${OUT_DIR}/monitor-${run_id}-summary.json" \
  2> "${OUT_DIR}/monitor-${run_id}.log" &
monitor=$!
trap 'kill -INT "${monitor}" 2>/dev/null; wait "${monitor}" 2>/dev/null' EXIT

for rate in "$@"; do
  step="${OUT_DIR}/step-${rate}"
  mkdir -p "${step}"
  ( while true; do echo "$(date -u +%FT%TZ) $(bash -c "${HOST_LOAD_CMD}")"; sleep 10; done ) \
    > "${step}/host-load.txt" &
  sampler=$!
  started="$(date -u +%FT%TZ)"
  bash -c "${METRICS_CMD}" > "${step}/before.prom"
  pairs=$((rate / 40 > 3 ? rate / 40 : 3))
  RATE="${rate}" PAGE_RATE="$((rate / 40))" PAIRS="${pairs}" DURATION="${STEP_DURATION}" \
    OUT_DIR="${step}" bash "${here}/run-k6.sh" mixed.js > "${step}/k6.log" 2>&1
  bash -c "${METRICS_CMD}" > "${step}/after.prom"
  kill "${sampler}" 2>/dev/null
  printf '{"rate":%s,"pairs":%s,"startedAt":"%s","finishedAt":"%s"}\n' \
    "${rate}" "${pairs}" "${started}" "$(date -u +%FT%TZ)" > "${step}/step.json"
  node "${here}/src/server-latency.ts" --before "${step}/before.prom" --after "${step}/after.prom" \
    > "${step}/server.md"
  failed="$(jq -r '.metrics.http_req_failed.value // 0' "${step}/mixed.summary.json" 2>/dev/null || echo 1)"
  echo "step ${rate}/s done: failed ${failed}, host load max $(cut -d' ' -f2 "${step}/host-load.txt" | sort -n | tail -1)"
  if awk -v f="${failed}" -v limit="${STOP_ERROR_RATE}" 'BEGIN { exit !(f > limit) }'; then
    echo "stopping: failed-request rate ${failed} is over ${STOP_ERROR_RATE}"
    break
  fi
done
