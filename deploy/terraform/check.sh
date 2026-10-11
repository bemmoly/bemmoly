#!/bin/sh
# Check the Terraform module and examples without cloud access: fmt, init, validate, the
# mocked tests and TFLint for each folder, plus the 300-line limit. CI runs this script.
#
#   sh deploy/terraform/check.sh                  # everything
#   sh deploy/terraform/check.sh examples/aws     # one folder, plus fmt and the line limit
#
# Runs against a copy of the folder, so no .terraform/ or lock file lands in the checkout.
# TF_PLUGIN_CACHE_DIR, when set, is reused for provider downloads with a local terraform.
set -eu

TF_ROOT=$(cd "$(dirname "$0")" && pwd)
DIRS='modules/bemmoly-vm examples/aws examples/gcp examples/hetzner'
if [ "$#" -gt 0 ]; then DIRS="$*"; fi

# One release of each tool everywhere, as lint-shell.sh does for ShellCheck: a lint that
# passes locally must not fail in CI. With another release installed, the images run.
TERRAFORM_VERSION=1.16.4
TERRAFORM_IMAGE=hashicorp/terraform:1.16.4@sha256:985cdc6c1d9b0a65b83377f666efd2f740b47f02ac55be1ced3d18f7d3b0e829
TFLINT_VERSION=0.64.0
TFLINT_IMAGE=ghcr.io/terraform-linters/tflint:v0.64.0@sha256:1c595f42d794c32c45a6ea8b58655fd66433d4ca3b1bc631c574a48d120bd19f

# What each folder goes through; $1 is the folder inside a disposable copy of TF_ROOT.
# init output is only shown when it fails, since provider downloads are long and routine.
# shellcheck disable=SC2016 # expanded by the shell that runs the suite, not this one
SUITE='set -eu
cd "$1"
log=$(mktemp)
terraform init -backend=false -input=false -no-color >"${log}" 2>&1 || { cat "${log}"; exit 1; }
terraform validate -no-color
terraform test -no-color'

installed() {
  command -v "$1" >/dev/null 2>&1 || return 1
  case "$1" in
    terraform) terraform version | awk 'NR == 1 { sub(/^v/, "", $2); print $2 }' ;;
    tflint) tflint --version | awk '/^TFLint version/ { print $3 }' ;;
  esac
}

need_docker() {
  command -v docker >/dev/null 2>&1 && return 0
  echo "terraform check: needs $1 or Docker for $2" >&2
  exit 1
}

WORK=$(mktemp -d)
trap 'rm -rf "${WORK}"' EXIT INT TERM

if [ "$(installed terraform || true)" = "${TERRAFORM_VERSION}" ]; then
  export CHECKPOINT_DISABLE=1 TF_IN_AUTOMATION=1
  export TF_PLUGIN_CACHE_DIR="${TF_PLUGIN_CACHE_DIR:-${WORK}/plugins}"
  mkdir -p "${TF_PLUGIN_CACHE_DIR}"
  cp -R "${TF_ROOT}" "${WORK}/src"
  tf_fmt() { terraform fmt -check -recursive -diff "${TF_ROOT}"; }
  tf_suite() { sh -c "${SUITE}" sh "${WORK}/src/$1"; }
else
  need_docker "Terraform ${TERRAFORM_VERSION}" "${TERRAFORM_IMAGE}"
  # Read-only mount, copied inside the container: the providers, .terraform/ and the lock
  # file live and die with the container, which downloads each provider once.
  tf_docker() {
    docker run --rm -v "${TF_ROOT}:/src:ro" -e CHECKPOINT_DISABLE=1 -e TF_IN_AUTOMATION=1 \
      --entrypoint /bin/sh "${TERRAFORM_IMAGE}" -c "$@"
  }
  tf_fmt() { tf_docker 'terraform fmt -check -recursive -diff /src'; }
  tf_suite() { tf_docker "cp -R /src /tmp/work && sh -c '${SUITE}' sh /tmp/work/$1"; }
fi

if [ "$(installed tflint || true)" = "${TFLINT_VERSION}" ]; then
  tf_lint() { tflint --chdir="${TF_ROOT}/$1" --config="${TF_ROOT}/.tflint.hcl" --no-color; }
else
  need_docker "TFLint ${TFLINT_VERSION}" "${TFLINT_IMAGE}"
  tf_lint() {
    docker run --rm -v "${TF_ROOT}:/src:ro" -w "/src/$1" "${TFLINT_IMAGE}" --config=/src/.tflint.hcl --no-color
  }
fi

status=0
# Every check runs even after one fails, so a single CI run reports all of them.
result() {
  if [ "$1" -eq 0 ]; then
    echo "ok: $2"
  else
    echo "FAILED: $2" >&2
    status=1
  fi
}

echo '==> terraform fmt'
rc=0 && tf_fmt || rc=$?
result "${rc}" 'terraform fmt'

for dir in ${DIRS}; do
  echo "==> ${dir}: init, validate, test"
  rc=0 && tf_suite "${dir}" || rc=$?
  result "${rc}" "${dir}: init, validate, test"
  echo "==> ${dir}: tflint"
  rc=0 && tf_lint "${dir}" || rc=$?
  result "${rc}" "${dir}: tflint"
done

echo '==> files under 300 lines'
rc=0
for file in $(cd "${TF_ROOT}" && find . -type f ! -path '*/.terraform/*' | sort); do
  lines=$(wc -l <"${TF_ROOT}/${file}")
  if [ "${lines}" -gt 300 ]; then
    echo "${file} has ${lines} lines; the limit is 300. Split it by responsibility." >&2
    rc=1
  fi
done
result "${rc}" 'files under 300 lines'

exit "${status}"
