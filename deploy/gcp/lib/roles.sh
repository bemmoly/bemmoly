# shellcheck shell=sh
# The control identity's roles: what it holds on the Bemmoly folder and on the billing
# account, and why. Everything is scoped to the folder, never the organisation, so the
# control plane can touch nothing outside it.

# Held while landing zones are built. --lock removes exactly these, --unlock puts them back.
#   folderCreator        a folder per domain under Bemmoly, for the per-domain layouts
#   projectCreator       a project per environment (or per domain and environment)
#   billing.projectManager  links each new project to the billing account; billing.user on
#                        the account is the other half of that permission
#   serviceUsageAdmin    enables the APIs each landing zone needs in its project
#   serviceAccountAdmin  creates each environment's deployer@ and runtime identities
#   projectIamAdmin      grants deployer@ its deploy roles inside its own project
# Not folderAdmin: it can rewrite the folder's own policy, so a compromised control plane
# could grant itself back what --lock took away.
PROVISIONING_ROLES='roles/resourcemanager.folderCreator
roles/resourcemanager.projectCreator
roles/billing.projectManager
roles/serviceusage.serviceUsageAdmin
roles/iam.serviceAccountAdmin
roles/resourcemanager.projectIamAdmin'

# Kept after --lock: day-to-day work once the landing zones exist.
#   serviceAccountTokenCreator  impersonates each environment's deployer@ for every deploy,
#                        so that project's audit logs name the deployer, not the control plane
#   folderViewer         reads the folder tree for the map and the nightly drift scan
DEPLOY_ROLES='roles/iam.serviceAccountTokenCreator
roles/resourcemanager.folderViewer'

# On the billing account, kept after --lock.
#   billing.user         links projects to the account (with billing.projectManager above)
#   billing.costsManager budgets per environment and spend for the cost views
BILLING_ROLES='roles/billing.user
roles/billing.costsManager'

FOLDER_IAM_FIX='You need Folder IAM Admin (roles/resourcemanager.folderIamAdmin) on the folder, or Organization Administrator.'

# The roles the control identity already holds on the folder, one per line.
folder_roles() {
  if [ -n "${PLANNED_FOLDER}" ]; then return 0; fi
  gc resource-manager folders get-iam-policy "${FOLDER_ID}" --flatten='bindings[].members' \
    --filter="bindings.members:serviceAccount:${SA_EMAIL}" --format='value(bindings.role)' ||
    die "Cannot read the access policy of folder ${FOLDER_ID}" "${FOLDER_IAM_FIX}"
}

# grant_folder_roles ROLES  adds the ones the control identity does not hold yet.
grant_folder_roles() {
  held=$(folder_roles)
  added=''
  for role in $1; do
    if has_line "${held}" "${role}"; then continue; fi
    gc_change "${FOLDER_IAM_FIX}" resource-manager folders add-iam-policy-binding "${FOLDER_ID}" \
      --member="serviceAccount:${SA_EMAIL}" --role="${role}" --condition=None
    added=1
  done
  if [ -z "${added}" ]; then skip "The control identity holds its roles on folder ${FOLDER_ID}"; fi
}

# Removes the provisioning roles; the deploy roles and the billing roles stay.
revoke_provisioning_roles() {
  held=$(folder_roles)
  removed=''
  for role in ${PROVISIONING_ROLES}; do
    if ! has_line "${held}" "${role}"; then continue; fi
    gc_change "${FOLDER_IAM_FIX}" resource-manager folders remove-iam-policy-binding "${FOLDER_ID}" \
      --member="serviceAccount:${SA_EMAIL}" --role="${role}" --all
    removed=1
  done
  if [ -z "${removed}" ]; then skip 'No provisioning roles were left on the folder'; fi
}

grant_billing_roles() {
  held=$(gc billing accounts get-iam-policy "${BILLING}" --flatten='bindings[].members' \
    --filter="bindings.members:serviceAccount:${SA_EMAIL}" --format='value(bindings.role)') ||
    die "Cannot read the access policy of billing account ${BILLING}" 'You need Billing Account Administrator on it.'
  added=''
  for role in ${BILLING_ROLES}; do
    if has_line "${held}" "${role}"; then continue; fi
    gc_change "You need Billing Account Administrator on ${BILLING}." \
      billing accounts add-iam-policy-binding "${BILLING}" --member="serviceAccount:${SA_EMAIL}" --role="${role}"
    added=1
  done
  if [ -z "${added}" ]; then skip "The control identity holds its roles on billing account ${BILLING}"; fi
}
