#!/usr/bin/env bash
# Opens an issue for a failed nightly job, or comments on the open one with the same
# title, so a run of red nights is one thread. Needs GH_TOKEN and RUN_URL.
#
#   report-nightly-failure.sh '<issue title>' <label>
set -euo pipefail

title="$1"
label="$2"
body="The scheduled run failed: ${RUN_URL}"

existing="$(gh issue list --state open --label "$label" --search "in:title \"$title\"" \
  --json number --jq '.[0].number // empty')"

if [ -n "$existing" ]; then
  gh issue comment "$existing" --body "$body"
else
  gh issue create --title "$title" --label "$label" --body "$body"
fi
