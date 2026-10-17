#!/usr/bin/env bats
# The Google Cloud bootstrap against a fake gcloud: no network, no real account. The fake
# logs every call and answers reads from files under $FAKE_STATE, which its writes update.

setup() {
  DEPLOY_DIR="$(cd "${BATS_TEST_DIRNAME}/../.." && pwd)"
  BOOTSTRAP="${DEPLOY_DIR}/gcp/bootstrap.sh"
  export FAKE_LOG="${BATS_TEST_TMPDIR}/calls" FAKE_STATE="${BATS_TEST_TMPDIR}/state"
  mkdir -p "${BATS_TEST_TMPDIR}/bin" "${FAKE_STATE}"
  : >"${FAKE_LOG}"
  echo 'organizations/123456789012' >"${FAKE_STATE}/orgs"
  cat >"${BATS_TEST_TMPDIR}/bin/gcloud" <<'FAKE'
#!/usr/bin/env bash
set -u
printf '%s\n' "$*" >>"${FAKE_LOG}"
s="${FAKE_STATE}"
flag() { for a in "${@:2}"; do [[ "${a}" == "$1="* ]] && printf '%s' "${a#*=}" && return; done; }
show() { cat "$s/$1" 2>/dev/null || true; }
add() { grep -qxF "$2" "$s/$1" 2>/dev/null || echo "$2" >>"$s/$1"; }
drop() { grep -vxF "$2" "$s/$1" >"$s/$1.new" || true; mv "$s/$1.new" "$s/$1"; }
role=$(flag --role "$@")
case "$*" in
  'config get-value account') echo admin@acme.dev ;;
  'organizations list'*) cat "$s/orgs" ;;
  'organizations describe '*) grep -q "$3" "$s/orgs" ;;
  'billing accounts describe '*) echo True ;;
  'billing accounts get-iam-policy '*)
    [ -z "${FAKE_DENY_BILLING:-}" ] || { echo 'PERMISSION_DENIED' >&2; exit 1; }
    show billing-roles ;;
  'billing accounts add-iam-policy-binding '*) add billing-roles "${role}" ;;
  'billing projects describe '*) show billing-link ;;
  'billing projects link '*) echo "billingAccounts/$(flag --billing-account "$@")" >"$s/billing-link" ;;
  'resource-manager folders list '*) show folder ;;
  'resource-manager folders create '*) echo folders/1001 >"$s/folder" ;;
  'resource-manager folders get-iam-policy '*) show folder-roles ;;
  'resource-manager folders add-iam-policy-binding '*) add folder-roles "${role}" ;;
  'resource-manager folders remove-iam-policy-binding '*) drop folder-roles "${role}" ;;
  'projects describe '*)
    [ -f "$s/project" ] || exit 1
    case "$*" in *projectNumber*) echo 424242 ;; *) echo 1001 ;; esac ;;
  'projects create '*) touch "$s/project" ;;
  'services list '*) show services ;;
  'services enable '*) for a in "${@:3}"; do [[ "${a}" == --* ]] || add services "${a}"; done ;;
  'iam service-accounts describe '*) [ -f "$s/sa" ] ;;
  'iam service-accounts create '*) touch "$s/sa" ;;
  'iam service-accounts get-iam-policy '*) show sa-roles ;;
  'iam service-accounts add-iam-policy-binding '*) add sa-roles "${role}" ;;
  'iam workload-identity-pools providers describe '*) [ -f "$s/provider" ] ;;
  'iam workload-identity-pools providers create-oidc '*) printf '%s\n' "$*" >"$s/provider" ;;
  'iam workload-identity-pools describe '*) [ -f "$s/pool" ] && echo ACTIVE ;;
  'iam workload-identity-pools create '*) touch "$s/pool" ;;
  'compute firewall-rules describe '*) [ -f "$s/firewall" ] ;;
  'compute firewall-rules create '*) touch "$s/firewall" ;;
  'compute instances describe '*) [ -f "$s/vm" ] ;;
  'compute instances create '*) printf '%s\n' "$*" >"$s/vm" ;;
  *) echo "fake gcloud: unexpected call: $*" >&2 && exit 2 ;;
esac
FAKE
  chmod +x "${BATS_TEST_TMPDIR}/bin/gcloud"
  PATH="${BATS_TEST_TMPDIR}/bin:${PATH}"
  export JWKS="${BATS_TEST_TMPDIR}/jwks.json"
  echo '{"keys":[{"kty":"EC","crv":"P-256","kid":"k1","x":"AA","y":"BB"}]}' >"${JWKS}"
}

bootstrap() { run sh "${BOOTSTRAP}" --org 123456789012 --billing 0123AB-4567CD-89EF01 --yes "$@"; }

# Bats does not fail a test on a bare `! cmd`, so negative checks go through functions.
lacks() { ! grep -q -- "$1" "$2"; }
lacks_line() { ! grep -qxF -- "$1" "$2"; }

# Every call that changes something, from the fake's log.
changes() { grep -E ' (create|create-oidc|undelete|enable|link|add-iam-policy-binding|remove-iam-policy-binding) ' "${FAKE_LOG}" || true; }

PROVISIONING='roles/resourcemanager.folderCreator roles/resourcemanager.projectCreator
roles/billing.projectManager roles/serviceusage.serviceUsageAdmin roles/iam.serviceAccountAdmin
roles/resourcemanager.projectIamAdmin'

@test "--dry-run reads, prints the plan and changes nothing" {
  bootstrap --dry-run
  [ "${status}" -eq 0 ]
  [ -z "$(changes)" ]
  [ ! -f "${FAKE_STATE}/folder" ]
  [[ "${output}" == *"+ gcloud resource-manager folders list --organization=123456789012"* ]]
  [[ "${output}" == *"[dry run] gcloud resource-manager folders create --display-name=Bemmoly --organization=123456789012"* ]]
  [[ "${output}" == *"[dry run] gcloud projects create bemmoly-control-123456789012 --folder=NEW_FOLDER_ID"* ]]
  [[ "${output}" == *"[dry run] gcloud iam service-accounts create bemmoly-control"* ]]
  [[ "${output}" == *"roles/resourcemanager.projectCreator"* ]]
  [[ "${output}" == *"nothing was changed"* ]]
}

@test "a first run creates the folder, project, identity, APIs and every binding" {
  bootstrap
  [ "${status}" -eq 0 ]
  grep -qx 'resource-manager folders create --display-name=Bemmoly --organization=123456789012' "${FAKE_LOG}"
  grep -q '^projects create bemmoly-control-123456789012 --folder=1001 ' "${FAKE_LOG}"
  grep -qx 'billing projects link bemmoly-control-123456789012 --billing-account=0123AB-4567CD-89EF01' "${FAKE_LOG}"
  grep -q '^iam service-accounts create bemmoly-control --project=bemmoly-control-123456789012' "${FAKE_LOG}"
  grep -q '^services enable .*iamcredentials.googleapis.com.*compute.googleapis.com' "${FAKE_LOG}"
  for role in ${PROVISIONING} roles/iam.serviceAccountTokenCreator roles/resourcemanager.folderViewer; do
    grep -qxF "${role}" "${FAKE_STATE}/folder-roles"
  done
  grep -qx roles/billing.user "${FAKE_STATE}/billing-roles"
  grep -qx roles/billing.costsManager "${FAKE_STATE}/billing-roles"
  grep -q 'member=serviceAccount:bemmoly-control@bemmoly-control-123456789012.iam.gserviceaccount.com' "${FAKE_LOG}"
  grep -q -- '--service-account=bemmoly-control@' "${FAKE_STATE}/vm"
  [[ "${output}" == *"+ gcloud projects create bemmoly-control-123456789012"* ]]
  [[ "${output}" == *"--lock"* ]]
  # Keyless: no service account key is ever created or downloaded.
  lacks 'keys create' "${FAKE_LOG}"
}

@test "a second run finds everything in place and changes nothing" {
  bootstrap
  [ "${status}" -eq 0 ]
  : >"${FAKE_LOG}"
  bootstrap
  [ "${status}" -eq 0 ]
  [ -z "$(changes)" ]
  [[ "${output}" == *"Folder Bemmoly exists (folders/1001)"* ]]
  [[ "${output}" == *"Project bemmoly-control-123456789012 exists"* ]]
  [[ "${output}" == *"holds its roles on folder 1001"* ]]
}

@test "--lock removes only the provisioning roles and --unlock restores them" {
  bootstrap
  : >"${FAKE_LOG}"
  bootstrap --lock
  [ "${status}" -eq 0 ]
  for role in ${PROVISIONING}; do
    lacks_line "${role}" "${FAKE_STATE}/folder-roles"
    grep -q "remove-iam-policy-binding 1001 .*--role=${role} --all" "${FAKE_LOG}"
  done
  grep -qx roles/iam.serviceAccountTokenCreator "${FAKE_STATE}/folder-roles"
  grep -qx roles/resourcemanager.folderViewer "${FAKE_STATE}/folder-roles"
  grep -qx roles/billing.costsManager "${FAKE_STATE}/billing-roles"
  lacks ' create ' "${FAKE_LOG}"

  bootstrap --lock
  [[ "${output}" == *"No provisioning roles were left"* ]]

  : >"${FAKE_LOG}"
  bootstrap --unlock
  [ "${status}" -eq 0 ]
  for role in ${PROVISIONING}; do grep -qxF "${role}" "${FAKE_STATE}/folder-roles"; done
  [ -z "$(changes | grep -v add-iam-policy-binding)" ]
}

@test "--lock before the bootstrap says to run it first" {
  bootstrap --lock
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"There is no Bemmoly folder"* ]]
  [ -z "$(changes)" ]
}

@test "without an organisation it stops and explains why one is needed" {
  : >"${FAKE_STATE}/orgs"
  run sh "${BOOTSTRAP}" --billing 0123AB-4567CD-89EF01 --yes
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"An organisation is required"* ]]
  [[ "${output}" == *"only lets service accounts create projects inside an organisation"* ]]
  [[ "${output}" == *"--org"* ]]
  [ -z "$(changes)" ]
}

@test "with one organisation visible and no --org, that one is used" {
  run sh "${BOOTSTRAP}" --billing 0123AB-4567CD-89EF01 --dry-run
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"Using organisation 123456789012"* ]]
}

@test "without permission on the billing account it stops before creating anything" {
  FAKE_DENY_BILLING=1 bootstrap
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"cannot manage access to billing account 0123AB-4567CD-89EF01"* ]]
  [[ "${output}" == *"Fix: Ask a Billing Account Administrator"* ]]
  [ -z "$(changes)" ]
}

@test "--wif-jwks creates the pool and an OIDC provider holding the JWKS, once" {
  bootstrap --wif-jwks "${JWKS}" --wif-issuer https://bemmoly.acme.dev/pipelines
  [ "${status}" -eq 0 ]
  grep -q '^iam workload-identity-pools create bemmoly --project=bemmoly-control-123456789012 --location=global' "${FAKE_LOG}"
  grep -q -- "--jwk-json-path=${JWKS}" "${FAKE_STATE}/provider"
  grep -q -- '--issuer-uri=https://bemmoly.acme.dev/pipelines' "${FAKE_STATE}/provider"
  grep -qx roles/iam.workloadIdentityUser "${FAKE_STATE}/sa-roles"
  grep -q 'member=principalSet://iam.googleapis.com/projects/424242/locations/global/workloadIdentityPools/bemmoly/\*' "${FAKE_LOG}"
  # Off Google Cloud there is no VM.
  lacks '^compute ' "${FAKE_LOG}"
  [[ "${output}" == *"workloadIdentityPools/bemmoly/providers/bemmoly-control"* ]]

  : >"${FAKE_LOG}"
  bootstrap --wif-jwks "${JWKS}" --wif-issuer https://bemmoly.acme.dev/pipelines
  [ "${status}" -eq 0 ]
  [ -z "$(changes)" ]
}

@test "--wif-jwks refuses a file that is not a JWKS, and needs an issuer" {
  echo '{"type":"service_account"}' >"${BATS_TEST_TMPDIR}/key.json"
  bootstrap --wif-jwks "${BATS_TEST_TMPDIR}/key.json" --wif-issuer https://x.dev
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"is not a JWKS"* ]]
  bootstrap --wif-jwks "${JWKS}"
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"--wif-issuer must be the https:// URL"* ]]
  [ ! -s "${FAKE_LOG}" ]
}

@test "--mode helm prints the Helm command and creates no VM" {
  bootstrap --mode helm
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"helm install bemmoly"* ]]
  [[ "${output}" == *"iam.gke.io/gcp-service-account=bemmoly-control@bemmoly-control-123456789012.iam.gserviceaccount.com"* ]]
  lacks '^compute ' "${FAKE_LOG}"
  lacks 'compute.googleapis.com' "${FAKE_LOG}"
}

@test "bad options fail with a fix, and --help exits 0" {
  run sh "${BOOTSTRAP}" --mode cluster
  [ "${status}" -eq 1 ]
  [[ "${output}" == *"--mode must be vm, helm or none"* ]]
  run sh "${BOOTSTRAP}" --control-project Bad_Id
  [[ "${output}" == *"--control-project must be"* ]]
  run sh "${BOOTSTRAP}" --org
  [[ "${output}" == *"--org needs a value"* ]]
  run sh "${BOOTSTRAP}" --frobnicate
  [[ "${output}" == *"Unknown option: --frobnicate"* ]]
  run sh "${BOOTSTRAP}" --help
  [ "${status}" -eq 0 ]
  [[ "${output}" == *"--wif-jwks FILE"* ]]
  [[ "${output}" == *"--lock"* ]]
  [ ! -s "${FAKE_LOG}" ]
}
