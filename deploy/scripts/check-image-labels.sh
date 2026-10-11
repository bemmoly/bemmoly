#!/bin/sh
# Fails when a built image's OCI labels are missing or were left at a placeholder, so a
# release can never again report its revision as "unknown". Every label that matters to
# someone reading `docker inspect` must be present and real: revision is the full commit
# SHA, created and version are set, and no label anywhere says "unknown".
#
#   check-image-labels.sh <image>             an image in the local Docker store
#   check-image-labels.sh --remote <image>    a pushed image or multi-platform index
#   check-image-labels.sh -                   label sets as JSON on stdin: [{"key": "value"}]
#
# Needs jq, and Docker (with buildx for --remote) unless reading stdin.
set -eu

usage() {
  echo "usage: check-image-labels.sh <image> | --remote <image> | -" >&2
  exit 2
}

[ "$#" -ge 1 ] || usage
case "$1" in
  -)
    sets=$(cat)
    ref="stdin"
    ;;
  --remote)
    [ "$#" -eq 2 ] || usage
    ref=$2
    # One image config per platform; collect the labels of each.
    sets=$(docker buildx imagetools inspect "${ref}" --format '{{json .Image}}' |
      jq -c '[.. | objects | .config? | objects | .Labels // {}]')
    ;;
  *)
    [ "$#" -eq 1 ] || usage
    ref=$1
    sets=$(docker image inspect --format '{{json .Config.Labels}}' "${ref}" | jq -c '[. // {}]')
    ;;
esac

problems=$(printf '%s' "${sets}" | jq -r '
  def required: [
    "org.opencontainers.image.revision",
    "org.opencontainers.image.created",
    "org.opencontainers.image.version",
    "org.opencontainers.image.source"
  ];
  if (type != "array") or length == 0 then "no image configuration found"
  else
    .[] as $labels
    | (required[] as $key
        | ($labels[$key] // "") as $value
        | if $value == "" then "\($key) is missing"
          elif $key == "org.opencontainers.image.revision" and $value != "unknown"
            and ($value | test("^[0-9a-f]{40}$") | not)
          then "\($key) is \"\($value)\", not a commit SHA"
          else empty end),
      ($labels | to_entries[] | select(.value == "unknown") | "\(.key) is \"unknown\"")
  end' | sort -u)

if [ -n "${problems}" ]; then
  echo "check-image-labels: ${ref} has placeholder or missing labels:" >&2
  printf '%s\n' "${problems}" | sed 's/^/  /' >&2
  echo "Fix: pass REVISION, CREATED and BEMMOLY_VERSION as build args to every image build." >&2
  exit 1
fi
echo "check-image-labels: ${ref} labels are complete"
