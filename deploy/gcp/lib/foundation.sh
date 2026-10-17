# shellcheck shell=sh
# Preflight, the Bemmoly folder, the control project, its APIs and the control identity.
# Each step reads first and only creates what is missing, so running the bootstrap again
# is safe and changes nothing that is already in place.

# The control project's APIs. Resource Manager, Billing, Service Usage and IAM let the
# control plane build landing zones; IAM Credentials and STS mint the short-lived tokens it
# uses to impersonate each environment's deployer (and exchange federated tokens off Google
# Cloud); the rest are what it deploys to, pushes to, stores secrets in and reads metrics from.
CONTROL_APIS='cloudresourcemanager.googleapis.com cloudbilling.googleapis.com
serviceusage.googleapis.com iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com
run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
monitoring.googleapis.com cloudbuild.googleapis.com'

preflight() {
  have gcloud || die 'The gcloud command is not installed' \
    'Open Cloud Shell (https://shell.cloud.google.com), where gcloud is ready, or install the Google Cloud CLI.'
  account=$(gc config get-value account 2>/dev/null) || account=''
  [ -n "${account}" ] || die 'gcloud is not signed in' 'Run gcloud auth login, then run this again.'
  note "Signed in as ${account}"
  resolve_org
  PROJECT="${PROJECT:-$(printf 'bemmoly-control-%s' "${ORG}" | cut -c 1-30)}"
  SA_EMAIL="bemmoly-control@${PROJECT}.iam.gserviceaccount.com"
  if [ -z "${LOCK}" ]; then check_billing; fi
}

# Service accounts cannot create projects without a parent, so the control identity needs
# an organisation to hold the Bemmoly folder. With exactly one visible, that one is used.
resolve_org() {
  if [ -z "${ORG}" ]; then
    orgs=$(gc organizations list --format='value(name)' 2>/dev/null) || orgs=''
    orgs=$(printf '%s\n' "${orgs}" | sed -n 's|^organizations/||; /^[0-9][0-9]*$/p')
    case "$(printf '%s' "${orgs}" | grep -c .)" in
      0) die 'An organisation is required, and this account sees none' \
        'Bemmoly creates a project per environment as a service account, and Google Cloud only lets service accounts create projects inside an organisation. Set one up (Cloud Identity Free is enough), then run again with --org <id> (see: gcloud organizations list).' ;;
      1) ORG="${orgs}" && note "Using organisation ${ORG}, the only one this account sees" ;;
      *) die "This account sees several organisations: $(printf '%s' "${orgs}" | tr '\n' ' ')" \
        'Run again with --org <id> to pick the one Bemmoly belongs in.' ;;
    esac
  fi
  gc_exists organizations describe "${ORG}" ||
    die "Organisation ${ORG} was not found, or this account cannot see it" \
      'Check the id with gcloud organizations list; you need at least Organization Viewer on it.'
}

check_billing() {
  [ -n "${BILLING}" ] || die '--billing is required' \
    'Find the billing account id with gcloud billing accounts list, then pass --billing <id>.'
  open=$(gc billing accounts describe "${BILLING}" --format='value(open)' 2>/dev/null) ||
    die "Billing account ${BILLING} was not found, or this account cannot see it" \
      'Check the id with gcloud billing accounts list.'
  [ "${open}" = True ] || die "Billing account ${BILLING} is closed" 'Pick an open one from gcloud billing accounts list.'
  # Granting billing.user and billing.costsManager needs the account's IAM policy; checking
  # it now stops before anything is created rather than halfway through.
  gc billing accounts get-iam-policy "${BILLING}" --format='value(etag)' >/dev/null 2>&1 ||
    die "This account cannot manage access to billing account ${BILLING}" \
      'Ask a Billing Account Administrator to grant you roles/billing.admin on it, or to run this bootstrap.'
}

find_folder() {
  folders=$(gc resource-manager folders list --organization="${ORG}" \
    --filter="displayName=\"${FOLDER_NAME}\" AND lifecycleState=ACTIVE" --format='value(name)') ||
    die "Cannot list the folders of organisation ${ORG}" 'You need Folder Viewer (or Folder Creator) on the organisation.'
  FOLDER_ID=$(printf '%s\n' "${folders}" | sed -n '1s|^folders/||p')
}

ensure_folder() {
  find_folder
  if [ -n "${FOLDER_ID}" ]; then
    skip "Folder ${FOLDER_NAME} exists (folders/${FOLDER_ID})"
    return 0
  fi
  note "Creating the folder ${FOLDER_NAME}"
  gc_change "You need Folder Creator (roles/resourcemanager.folderCreator) on organisation ${ORG}." \
    resource-manager folders create --display-name="${FOLDER_NAME}" --organization="${ORG}"
  if [ -n "${DRY_RUN}" ]; then
    FOLDER_ID=NEW_FOLDER_ID PLANNED_FOLDER=1
    return 0
  fi
  find_folder
  [ -n "${FOLDER_ID}" ] || die "The folder ${FOLDER_NAME} was created but cannot be listed yet" 'Wait a minute and run this again.'
}

ensure_project() {
  if parent=$(gc projects describe "${PROJECT}" --format='value(parent.id)' 2>/dev/null); then
    skip "Project ${PROJECT} exists"
    [ "${parent}" = "${FOLDER_ID}" ] ||
      warn "Project ${PROJECT} sits outside the ${FOLDER_NAME} folder; that works, the control identity's roles are on the folder."
  else
    note "Creating the control project ${PROJECT}"
    gc_change "Project ids are unique across Google Cloud: if ${PROJECT} is taken, pick another with --control-project. You also need Project Creator on the folder." \
      projects create "${PROJECT}" --folder="${FOLDER_ID}" --name='Bemmoly control' --labels=application=bemmoly
    if [ -n "${DRY_RUN}" ]; then PLANNED_PROJECT=1; fi
  fi
  linked=''
  if [ -z "${PLANNED_PROJECT}" ]; then
    linked=$(gc billing projects describe "${PROJECT}" --format='value(billingAccountName)') ||
      die "Cannot read the billing of project ${PROJECT}" 'You need Project Billing Manager or Owner on it.'
  fi
  case "${linked}" in
    "billingAccounts/${BILLING}") skip "Project ${PROJECT} is billed to ${BILLING}" ;;
    '') gc_change "You need Billing Account User on ${BILLING} and Project Billing Manager on ${PROJECT}." \
      billing projects link "${PROJECT}" --billing-account="${BILLING}" ;;
    *) warn "Project ${PROJECT} is billed to ${linked#billingAccounts/}, not ${BILLING}; it is left as it is." ;;
  esac
}

ensure_apis() {
  apis="${CONTROL_APIS}"
  if [ "${MODE}" = vm ]; then apis="${apis} compute.googleapis.com"; fi
  enabled=''
  if [ -z "${PLANNED_PROJECT}" ]; then
    enabled=$(gc services list --enabled --project="${PROJECT}" --format='value(config.name)') ||
      die "Cannot list the APIs of project ${PROJECT}" 'You need Service Usage Viewer or Owner on it.'
  fi
  missing=''
  for api in ${apis}; do
    has_line "${enabled}" "${api}" || missing="${missing} ${api}"
  done
  if [ -z "${missing}" ]; then
    skip 'The control project has every API it needs'
    return 0
  fi
  note "Enabling $(echo "${missing}" | wc -w | tr -d ' ') APIs on the control project"
  # shellcheck disable=SC2086 # one argument per API
  gc_change "You need Service Usage Admin on ${PROJECT}, and the project must be linked to an open billing account." \
    services enable ${missing} --project="${PROJECT}"
}

ensure_service_account() {
  if [ -z "${PLANNED_PROJECT}" ] && gc_exists iam service-accounts describe "${SA_EMAIL}" --project="${PROJECT}"; then
    skip "Control identity ${SA_EMAIL} exists"
    return 0
  fi
  note "Creating the control identity ${SA_EMAIL}"
  gc_change "You need Service Account Admin on ${PROJECT}." \
    iam service-accounts create bemmoly-control --project="${PROJECT}" \
    --display-name='Bemmoly control plane' --description='Builds landing zones and impersonates deployers'
  [ -z "${DRY_RUN}" ] || return 0
  # A new service account takes a few seconds to be visible to IAM policy changes.
  tries=0
  until gcloud iam service-accounts describe "${SA_EMAIL}" --project="${PROJECT}" >/dev/null 2>&1; do
    tries=$((tries + 1))
    [ "${tries}" -lt 10 ] || die "${SA_EMAIL} was created but is not visible yet" 'Wait a minute and run this again.'
    sleep 3
  done
}
