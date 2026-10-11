#!/usr/bin/env bash
# Runs the k6 scripts one after another against an install and writes the results table.
#
#   BASE_URL=… CREDENTIALS=… DATASET=… OUT_DIR=results bash perf/run-suite.sh [script …]
#
# Scripts default to the budget set: board issue search docs-page collab mixed. With
# METRICS_CMD (a command that prints the install's /metrics) each script also gets the
# server's own p50/p95/p99 per route, from scrapes taken just before and after it, so a slow
# network path is not read as a slow server. Writes OUT_DIR/<script>.log, .summary.json,
# .server.md and OUT_DIR/report.md; exits non-zero when any budget fails.
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export OUT_DIR="${OUT_DIR:-$(pwd)/perf-results}"
mkdir -p "${OUT_DIR}"
if [[ $# -gt 0 ]]; then scripts=("$@"); else scripts=(board issue search docs-page collab mixed); fi

status=0
for script in "${scripts[@]}"; do
  name="${script%.js}"
  echo "== ${name} $(date -u +%FT%TZ)"
  if [[ -n "${METRICS_CMD:-}" ]]; then bash -c "${METRICS_CMD}" > "${OUT_DIR}/${name}.before.prom"; fi
  bash "${here}/run-k6.sh" "${name}.js" > "${OUT_DIR}/${name}.log" 2>&1 || status=1
  if [[ -n "${METRICS_CMD:-}" ]]; then
    bash -c "${METRICS_CMD}" > "${OUT_DIR}/${name}.after.prom"
    node "${here}/src/server-latency.ts" --before "${OUT_DIR}/${name}.before.prom" \
      --after "${OUT_DIR}/${name}.after.prom" > "${OUT_DIR}/${name}.server.md"
  fi
  grep -E "✓|✗" "${OUT_DIR}/${name}.log" | grep -v "answers 2xx" || true
done

node "${here}/src/report.ts" "${OUT_DIR}"/*.summary.json > "${OUT_DIR}/report.md" || status=1
cat "${OUT_DIR}/report.md"
exit "${status}"
