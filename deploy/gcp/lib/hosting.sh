# shellcheck shell=sh
# Where the control plane runs and how it signs in to Google Cloud.
#   vm    a small VM in the control project, signed in as the control identity it runs as
#   helm  an existing GKE cluster: prints the Helm and Workload Identity commands to run there
#   none  outside Google Cloud, signing in through workload identity federation (--wif-jwks)
# No mode writes or downloads a service account key.

POOL=bemmoly
PROVIDER=bemmoly-control
VM_NAME=bemmoly-control

# Workload identity federation for a control plane outside Google Cloud. The provider holds
# Bemmoly's public JWKS itself, so Google never has to reach the control plane to check a
# token, and the control plane can stay on a private network.
ensure_wif() {
  pool_state=''
  if [ -z "${PLANNED_PROJECT}" ]; then
    pool_state=$(gc iam workload-identity-pools describe "${POOL}" --project="${PROJECT}" \
      --location=global --format='value(state)' 2>/dev/null) || pool_state=''
  fi
  case "${pool_state}" in
    ACTIVE) skip "Workload identity pool ${POOL} exists" ;;
    # A deleted pool keeps its id for 30 days; creating it again would fail until then.
    DELETED) gc_change "You need Workload Identity Pool Admin on ${PROJECT}." \
      iam workload-identity-pools undelete "${POOL}" --project="${PROJECT}" --location=global ;;
    *) gc_change "You need Workload Identity Pool Admin on ${PROJECT}." \
      iam workload-identity-pools create "${POOL}" --project="${PROJECT}" --location=global \
      --display-name=Bemmoly --description='The Bemmoly control plane, outside Google Cloud' ;;
  esac
  if [ -z "${PLANNED_PROJECT}" ] && [ "${pool_state}" = ACTIVE ] &&
    gc_exists iam workload-identity-pools providers describe "${PROVIDER}" \
      --workload-identity-pool="${POOL}" --project="${PROJECT}" --location=global; then
    skip "OIDC provider ${PROVIDER} exists; to upload new keys run the same command with providers update-oidc --jwk-json-path=${WIF_JWKS}"
  else
    gc_change "You need Workload Identity Pool Admin on ${PROJECT}." \
      iam workload-identity-pools providers create-oidc "${PROVIDER}" --workload-identity-pool="${POOL}" \
      --project="${PROJECT}" --location=global --issuer-uri="${WIF_ISSUER}" \
      --jwk-json-path="${WIF_JWKS}" --attribute-mapping=google.subject=assertion.sub
  fi

  number=PROJECT_NUMBER
  if [ -z "${PLANNED_PROJECT}" ]; then number=$(gc projects describe "${PROJECT}" --format='value(projectNumber)'); fi
  # Only Bemmoly holds the private keys behind the uploaded JWKS, and the pool has no other
  # provider, so every identity in the pool is the control plane.
  member="principalSet://iam.googleapis.com/projects/${number}/locations/global/workloadIdentityPools/${POOL}/*"
  held=''
  if [ -z "${PLANNED_PROJECT}" ]; then
    held=$(gc iam service-accounts get-iam-policy "${SA_EMAIL}" --project="${PROJECT}" \
      --flatten='bindings[].members' --filter="bindings.members:${member}" --format='value(bindings.role)' 2>/dev/null) || held=''
  fi
  if has_line "${held}" roles/iam.workloadIdentityUser; then
    skip "The pool may act as ${SA_EMAIL}"
  else
    gc_change "You need Service Account Admin on ${PROJECT}." \
      iam service-accounts add-iam-policy-binding "${SA_EMAIL}" --project="${PROJECT}" \
      --member="${member}" --role=roles/iam.workloadIdentityUser
  fi
  say ''
  say 'For the control plane'"'"'s Google Cloud connection:'
  say "  Audience:         //iam.googleapis.com/projects/${number}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}"
  say "  Service account:  ${SA_EMAIL}"
}

# A small VM that runs the one-machine installer on first boot, as the control identity.
ensure_vm() {
  zone="${REGION}-b"
  if [ -z "${PLANNED_PROJECT}" ] &&
    gc_exists compute firewall-rules describe "${VM_NAME}-web" --project="${PROJECT}"; then
    skip "Firewall rule ${VM_NAME}-web exists"
  else
    # Port 80 answers the certificate authority's HTTP challenge; 443 serves the app.
    gc_change "You need Compute Security Admin on ${PROJECT}." \
      compute firewall-rules create "${VM_NAME}-web" --project="${PROJECT}" --network=default \
      --direction=INGRESS --allow=tcp:80,tcp:443 --target-tags="${VM_NAME}" --source-ranges=0.0.0.0/0
  fi
  if [ -z "${PLANNED_PROJECT}" ] &&
    gc_exists compute instances describe "${VM_NAME}" --zone="${zone}" --project="${PROJECT}"; then
    skip "VM ${VM_NAME} exists in ${zone}"
    return 0
  fi
  note "Creating the VM ${VM_NAME} in ${zone}"
  # The startup script runs on every boot; the check keeps it to the first.
  gc_change "You need Compute Instance Admin on ${PROJECT}, and ${zone} must exist (pass --region)." \
    compute instances create "${VM_NAME}" --project="${PROJECT}" --zone="${zone}" \
    --machine-type=e2-medium --image-family=ubuntu-2404-lts-amd64 --image-project=ubuntu-os-cloud \
    --boot-disk-size=30GB --boot-disk-type=pd-balanced --shielded-secure-boot \
    --service-account="${SA_EMAIL}" --scopes=cloud-platform --tags="${VM_NAME}" --labels=application=bemmoly \
    --metadata=startup-script='[ -d /var/bemmoly ] || curl -fsSL https://get.bemmoly.com | sh -s -- --yes'
  say "  The installer runs on first boot; follow it with:"
  say "  gcloud compute instances get-serial-port-output ${VM_NAME} --zone=${zone} --project=${PROJECT}"
}

# GKE: nothing is changed here; the commands are for whoever runs the cluster.
print_helm() {
  # The chart sets no serviceAccountName, so its pods run as the namespace's default account.
  cat <<EOF

Install the control plane on your GKE cluster (Workload Identity on), from its project:

  helm install bemmoly bemmoly-X.Y.Z.tgz --namespace bemmoly --create-namespace \\
    --set externalDatabase.url='postgres://USER:PASSWORD@HOST:5432/bemmoly_db' \\
    --set publicUrl=https://bemmoly.example.com
  kubectl --namespace bemmoly annotate serviceaccount default iam.gke.io/gcp-service-account=${SA_EMAIL}
  gcloud iam service-accounts add-iam-policy-binding ${SA_EMAIL} --project=${PROJECT} \\
    --role=roles/iam.workloadIdentityUser --member='serviceAccount:CLUSTER_PROJECT.svc.id.goog[bemmoly/default]'

The chart is on https://github.com/bemmoly/bemmoly/releases; CLUSTER_PROJECT is the cluster's project.
EOF
}
