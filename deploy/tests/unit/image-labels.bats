#!/usr/bin/env bats
# Image labels: the check that fails a build whose OCI labels were left "unknown", and the
# workflows that must pass the build metadata to every image they build.

setup() {
  DEPLOY_DIR="$(cd "${BATS_TEST_DIRNAME}/../.." && pwd)"
  REPO_DIR="$(cd "${DEPLOY_DIR}/.." && pwd)"
  CHECK="${DEPLOY_DIR}/scripts/check-image-labels.sh"
  SHA=0123456789abcdef0123456789abcdef01234567
  GOOD="{\"org.opencontainers.image.revision\":\"${SHA}\",\"org.opencontainers.image.created\":\"2026-10-11T08:00:00Z\",\"org.opencontainers.image.version\":\"0.12.0\",\"org.opencontainers.image.source\":\"https://github.com/bemmoly/bemmoly\"}"
}

# A docker stub that prints $1 for any command, so the check can read "inspect" output.
stub_docker() {
  bin="${BATS_TEST_TMPDIR}/bin"
  mkdir -p "${bin}"
  printf '%s\n' "$1" >"${BATS_TEST_TMPDIR}/inspect.json"
  printf '#!/bin/sh\necho "$*" >>"%s/calls"\ncat "%s/inspect.json"\n' \
    "${BATS_TEST_TMPDIR}" "${BATS_TEST_TMPDIR}" >"${bin}/docker"
  chmod +x "${bin}/docker"
}

@test "complete labels pass" {
  run sh "${CHECK}" - <<<"[${GOOD}]"
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"labels are complete"* ]]
}

@test "a revision left at unknown fails, naming the label" {
  labels=$(jq -c '.["org.opencontainers.image.revision"] = "unknown"' <<<"${GOOD}")
  run sh "${CHECK}" - <<<"[${labels}]"
  [ "${status}" -eq 1 ]
  [[ "${output}" == *'org.opencontainers.image.revision is "unknown"'* ]]
  [[ "${output}" == *"Fix:"* ]]
}

@test "any other label left at unknown fails too" {
  labels=$(jq -c '.["org.opencontainers.image.created"] = "unknown" | .extra = "unknown"' <<<"${GOOD}")
  run sh "${CHECK}" - <<<"[${labels}]"
  [ "${status}" -eq 1 ]
  [[ "${output}" == *'org.opencontainers.image.created is "unknown"'* ]]
  [[ "${output}" == *'extra is "unknown"'* ]]
}

@test "a missing label or a short revision fails" {
  labels=$(jq -c 'del(.["org.opencontainers.image.version"]) | .["org.opencontainers.image.revision"] = "0123abc"' <<<"${GOOD}")
  run sh "${CHECK}" - <<<"[${labels}]"
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"org.opencontainers.image.version is missing"* ]]
  [[ "${output}" == *"not a commit SHA"* ]]
}

@test "a local image is read with docker image inspect" {
  stub_docker "${GOOD}"
  run env PATH="${BATS_TEST_TMPDIR}/bin:${PATH}" sh "${CHECK}" bemmoly:scan
  [ "${status}" -eq 0 ]
  grep -q '^image inspect --format {{json .Config.Labels}} bemmoly:scan$' "${BATS_TEST_TMPDIR}/calls"
}

@test "every platform of a pushed index is checked" {
  bad=$(jq -c '.["org.opencontainers.image.revision"] = "unknown"' <<<"${GOOD}")
  stub_docker "{\"linux/amd64\":{\"config\":{\"Labels\":${GOOD}}},\"linux/arm64\":{\"config\":{\"Labels\":${bad}}}}"
  run env PATH="${BATS_TEST_TMPDIR}/bin:${PATH}" sh "${CHECK}" --remote ghcr.io/bemmoly/bemmoly@sha256:abc
  [ "${status}" -eq 1 ]
  [[ "${output}" == *'revision is "unknown"'* ]]
  grep -q '^buildx imagetools inspect ghcr.io/bemmoly/bemmoly@sha256:abc' "${BATS_TEST_TMPDIR}/calls"

  stub_docker "{\"config\":{\"Labels\":${GOOD}}}"
  run env PATH="${BATS_TEST_TMPDIR}/bin:${PATH}" sh "${CHECK}" --remote ghcr.io/bemmoly/updater:1.0.0
  [ "${status}" -eq 0 ]
}

@test "every image build in the workflows passes the build metadata and is checked" {
  for workflow in "${REPO_DIR}"/.github/workflows/*.yml; do
    builds=$(grep -c 'uses: docker/build-push-action@' "${workflow}" || true)
    [ "${builds}" -gt 0 ] || continue
    for arg in REVISION= CREATED=; do
      passed=$(grep -c "^ *${arg}" "${workflow}" || true)
      if [ "${passed}" -lt "${builds}" ]; then
        echo "${workflow##*/}: ${builds} image builds but ${arg} passed ${passed} times" >&2
        return 1
      fi
    done
    checks=$(grep -c 'check-image-labels.sh' "${workflow}" || true)
    if [ "${checks}" -lt "${builds}" ]; then
      echo "${workflow##*/}: ${builds} image builds but ${checks} label checks" >&2
      return 1
    fi
  done
}
