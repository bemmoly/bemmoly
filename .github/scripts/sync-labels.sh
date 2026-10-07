#!/usr/bin/env bash
# Creates or updates every label in .github/labels.json. Labels that are not in the file
# are left alone, so nothing a maintainer added by hand is deleted. Needs GH_TOKEN.
set -euo pipefail

file="${1:-.github/labels.json}"

jq -c '.[]' "$file" | while read -r label; do
  name="$(jq -r '.name' <<< "$label")"
  color="$(jq -r '.color' <<< "$label")"
  description="$(jq -r '.description' <<< "$label")"
  gh label create "$name" --color "$color" --description "$description" --force
done
