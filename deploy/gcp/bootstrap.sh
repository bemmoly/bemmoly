#!/bin/sh
# Bemmoly Pipelines on Google Cloud: the one-time setup, run in Cloud Shell by someone who
# administers the organisation and its billing account.
#
#   sh deploy/gcp/bootstrap.sh --org 123456789012 --billing 0123AB-4567CD-89EF01 --dry-run
#
# It creates the Bemmoly folder and the control project, the control identity
# (bemmoly-control@) with folder-scoped roles and billing.user and billing.costsManager on the
# billing account, and then installs the control plane on a VM, prints the Helm command for
# an existing GKE cluster, or sets up workload identity federation for one running elsewhere.
# It ends by printing the values to paste into Pipelines › Connect › Create projects for me.
# Every gcloud command is printed before it runs; a second run only fills in what is missing.
# Run with --help for the options. MIT licensed.
set -eu

usage() {
  cat <<'EOF'
Set up Google Cloud for Bemmoly Pipelines: the Bemmoly folder, the control project, the
control identity and its roles, and where the control plane runs.

  sh deploy/gcp/bootstrap.sh --org ID --billing ACCOUNT [options]

Options:
  --org ID                 the organisation (default: the only one this account sees).
                           Required by Google Cloud: service accounts can only create
                           projects inside an organisation.
  --billing ACCOUNT        the billing account new projects are linked to
  --folder-name NAME       the folder everything goes in (default: Bemmoly)
  --control-project ID     the control project (default: bemmoly-control-<org id>)
  --region REGION          where the VM runs (default: us-central1)
  --mode vm|helm|none      vm: install the control plane on a small VM (default);
                           helm: print the Helm command for an existing GKE cluster;
                           none: the control plane runs outside Google Cloud
  --wif-jwks FILE          Bemmoly's public JWKS: create a workload identity pool and an
                           OIDC provider holding it, so a control plane outside Google Cloud
                           signs in without key files (implies --mode none)
  --wif-issuer URL         the control plane's OIDC issuer, with --wif-jwks
  --member PRINCIPAL       who gets the folder and billing roles instead of the control
                           identity, such as user:you@example.com for a laptop install that
                           signs in with your own gcloud credentials
  --dry-run                print every command; change nothing
  --lock                   remove the folder's provisioning roles once the landing zones are
                           in place; deploys keep working through each environment's deployer
  --unlock                 give the provisioning roles back, to add environments
  --yes                    do not ask before changing anything
  --help                   this text

Who can run it: an Organization Administrator who is also Billing Account Administrator,
or someone with Folder Creator, Project Creator and Folder IAM Admin on the organisation.
EOF
}

parse_args() {
  ORG='' BILLING='' FOLDER_NAME=Bemmoly PROJECT='' REGION=us-central1 MODE=''
  WIF_JWKS='' WIF_ISSUER='' DRY_RUN='' LOCK='' ASSUME_YES='' MEMBER=''
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --*=*)
        flag="${1%%=*}" value="${1#*=}"
        shift
        set -- "${flag}" "${value}" "$@"
        continue
        ;;
      --org | --billing | --folder-name | --control-project | --region | --mode | --wif-jwks | --wif-issuer | --member)
        if [ "$#" -lt 2 ] || [ -z "$2" ]; then die "$1 needs a value" 'See --help for the options.'; fi
        ;;
    esac
    case "$1" in
      --org) ORG="${2#organizations/}" && shift ;;
      --billing) BILLING="${2#billingAccounts/}" && shift ;;
      --folder-name) FOLDER_NAME="$2" && shift ;;
      --control-project) PROJECT="$2" && shift ;;
      --region) REGION="$2" && shift ;;
      --mode) MODE="$2" && shift ;;
      --wif-jwks) WIF_JWKS="$2" && shift ;;
      --wif-issuer) WIF_ISSUER="$2" && shift ;;
      --member) MEMBER="$2" && shift ;;
      --dry-run) DRY_RUN=1 ;;
      --lock) LOCK=lock ;;
      --unlock) LOCK=unlock ;;
      --yes | -y) ASSUME_YES=1 ;;
      --help | -h) usage && exit 0 ;;
      *) die "Unknown option: $1" 'See --help for the options.' ;;
    esac
    shift
  done
  validate_args
}

validate_args() {
  if [ -z "${MODE}" ]; then
    if [ -n "${WIF_JWKS}" ]; then MODE=none; else MODE=vm; fi
  fi
  case "${MODE}" in vm | helm | none) ;; *) die "--mode must be vm, helm or none (got ${MODE})" 'vm installs on a VM; helm prints the GKE command.' ;; esac
  case "${ORG}" in *[!0-9]*) die "--org must be the numeric organisation id (got ${ORG})" 'Find it with gcloud organizations list.' ;; esac
  case "${PROJECT}" in
    '') ;;
    [a-z][a-z0-9-][a-z0-9-][a-z0-9-][a-z0-9-]*[a-z0-9]) [ "${#PROJECT}" -le 30 ] || die "--control-project is longer than 30 characters" 'Pick a shorter project id.' ;;
    *) die "--control-project must be 6 to 30 lower-case letters, digits or hyphens, starting with a letter (got ${PROJECT})" 'Pick another project id.' ;;
  esac
  if [ -n "${WIF_JWKS}" ]; then
    [ -r "${WIF_JWKS}" ] || die "Cannot read ${WIF_JWKS}" 'Pass the JWKS file Bemmoly published (its public keys only).'
    grep -q '"keys"' "${WIF_JWKS}" || die "${WIF_JWKS} is not a JWKS (no \"keys\")" 'Pass the JSON Web Key Set the control plane publishes, not a private key.'
    case "${WIF_ISSUER}" in https://?*) ;; *) die '--wif-issuer must be the https:// URL of the control plane'"'"'s OIDC issuer' 'Pass it with --wif-jwks.' ;; esac
  elif [ -n "${WIF_ISSUER}" ]; then
    die '--wif-issuer needs --wif-jwks' 'Pass both, or neither.'
  fi
  case "${MEMBER}" in
    '' | user:?*@?* | serviceAccount:?*@?* | group:?*@?*) ;;
    *) die "--member must be user:, serviceAccount: or group: and an email (got ${MEMBER})" 'For example --member user:you@example.com.' ;;
  esac
}

lock_or_unlock() {
  find_folder
  [ -n "${FOLDER_ID}" ] || die "There is no ${FOLDER_NAME} folder in organisation ${ORG}" 'Run the bootstrap without --lock first.'
  if [ "${LOCK}" = lock ]; then
    confirm "Remove the provisioning roles of ${SA_EMAIL} from folder ${FOLDER_ID}?"
    revoke_provisioning_roles
    say "Locked: ${SA_EMAIL} keeps only its deploy and billing roles. New environments need --unlock first."
  else
    confirm "Give ${SA_EMAIL} its provisioning roles on folder ${FOLDER_ID} again?"
    grant_folder_roles "${PROVISIONING_ROLES}"
    say "Unlocked: ${SA_EMAIL} can build landing zones again. Run --lock when they are in place."
  fi
}

bootstrap() {
  say "Folder ${FOLDER_NAME} in organisation ${ORG}, control project ${PROJECT}, billing ${BILLING}, mode ${MODE}."
  confirm 'Create or update these now?'
  PLANNED_FOLDER='' PLANNED_PROJECT=''
  ensure_folder
  ensure_project
  ensure_apis
  ensure_service_account
  grant_folder_roles "${PROVISIONING_ROLES} ${DEPLOY_ROLES}"
  grant_billing_roles
  grant_project_roles
  if [ -n "${WIF_JWKS}" ]; then ensure_wif; fi
  case "${MODE}" in vm) ensure_vm ;; helm) print_helm ;; esac
  print_connect
  say 'Once the landing zones are in place, run this again with --lock to remove the provisioning roles.'
}

# The values Pipelines › Platform › Clouds › Connect a cloud › Create projects for me asks for.
print_connect() {
  if [ -n "${MEMBER}" ]; then
    sign_in='My gcloud sign-in on this machine'
  elif [ -n "${WIF_JWKS}" ]; then
    sign_in='A workload identity file (create it for the audience above)'
  else
    case "${MODE}" in
      vm | helm) sign_in='The VM Bemmoly runs on' ;;
      none) sign_in='A workload identity file' ;;
    esac
  fi
  say ''
  say 'Paste these into Pipelines › Platform › Clouds › Connect a cloud › Create projects for me:'
  say ''
  say "  Folder ID:         ${FOLDER_ID}"
  say "  Billing account:   ${BILLING}"
  say "  Control project:   ${PROJECT}"
  say "  Default region:    ${REGION}"
  say "  Sign in with:      ${sign_in}"
  say ''
  say "  Granted to:        $(grantee)"
  say ''
}

main() {
  exec 3>&2
  GCP_DIR=$(cd "$(dirname "$0")" && pwd)
  for lib in common foundation roles hosting; do
    # shellcheck source=/dev/null
    . "${GCP_DIR}/lib/${lib}.sh"
  done
  parse_args "$@"
  if [ -n "${DRY_RUN}" ]; then say 'Dry run: commands that change anything are printed, not run.'; fi
  PLANNED_FOLDER='' PLANNED_PROJECT=''
  preflight
  if [ -n "${LOCK}" ]; then lock_or_unlock; else bootstrap; fi
  if [ -n "${DRY_RUN}" ]; then say 'Dry run: nothing was changed. Run again without --dry-run to apply.'; fi
}

main "$@"
