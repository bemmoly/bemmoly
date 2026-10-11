#!/bin/sh
# Installs the Helm chart on a throwaway kind cluster and proves what a real install needs:
# the bundled Postgres with pgvector, the generated Secret, both claims bound, the probes,
# the Ingress (Traefik) including the /collab WebSocket with a real session, `helm test`,
# an upgrade between two chart versions with the pre-upgrade changeset Job, an uninstall
# that keeps the Secret and the claims, and a reinstall that finds the data again. Last, the
# chart published with <from-version> (external database, its own Secret) is upgraded to
# this checkout's chart, as an existing install would be.
#
#   sh deploy/tests/helm/kind-install.sh <from-version> <to-version>
#
# The versions are published releases (images ghcr.io/bemmoly/bemmoly:<version>); the chart
# comes from this checkout, packaged once per version. Needs docker, kind, kubectl, helm,
# curl. KEEP_CLUSTER=1 leaves the cluster running; CLUSTER and LOCAL_PORT override defaults.
set -eu

FROM="${1:?usage: kind-install.sh <from-version> <to-version>}"
TO="${2:?usage: kind-install.sh <from-version> <to-version>}"
CLUSTER="${CLUSTER:-bemmoly-chart}"
LOCAL_PORT="${LOCAL_PORT:-18480}"
NODE_IMAGE='kindest/node:v1.37.0@sha256:a1ed56cfb0e7b93589bdf97c8cd566405a265939e3620fc4f5de89adff580ae5'
TRAEFIK_CHART_VERSION=41.6.1
NS=bemmoly
RELEASE=bemmoly
HOST=bemmoly.test
BASE="http://${HOST}:${LOCAL_PORT}"
CHART_DIR=$(cd "$(dirname "$0")/../../helm/bemmoly" && pwd)
WORK=$(mktemp -d)
FORWARD_PID=''

pass() { printf '✓ %s\n' "$*"; }
fail() {
  printf '✗ %s\n' "$*" >&2
  kubectl --namespace "${NS}" get pods,pvc,secret,ingress,jobs 2>/dev/null >&2 || true
  kubectl --namespace "${NS}" logs "deploy/${RELEASE}-all" --tail 60 2>/dev/null >&2 || true
  exit 1
}

cleanup() {
  [ -z "${FORWARD_PID}" ] || kill "${FORWARD_PID}" 2>/dev/null || true
  rm -rf "${WORK}"
  if [ -z "${KEEP_CLUSTER:-}" ]; then kind delete cluster --name "${CLUSTER}" >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT INT TERM

k() { kubectl --namespace "${NS}" "$@"; }
http() { curl -sS --max-time 15 --resolve "${HOST}:${LOCAL_PORT}:127.0.0.1" "$@"; }
secret_value() { k get secret "${RELEASE}-secrets" -o "jsonpath={.data.$1}" | base64 -d; }

# The /collab upgrade handshake through the Ingress; prints the HTTP status line's code.
collab_status() {
  # curl gives up after the 101 because the socket stays open; the status is all we need.
  http --http1.1 --max-time 5 -o /dev/null -w '%{http_code}' "$@" \
    -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' \
    -H "Sec-WebSocket-Key: $(head -c 16 /dev/urandom | base64)" -H "Origin: ${BASE}" \
    "${BASE}/collab" 2>/dev/null || true
}

wait_ready_url() {
  for _ in $(seq 1 60); do
    if http "${BASE}/readyz" 2>/dev/null | grep -q '"status":"ready"'; then return 0; fi
    sleep 3
  done
  fail "${BASE}/readyz did not answer ready through the Ingress"
}

forward_ingress() {
  [ -z "${FORWARD_PID}" ] || kill "${FORWARD_PID}" 2>/dev/null || true
  kubectl --namespace traefik port-forward svc/traefik "${LOCAL_PORT}:80" >"${WORK}/forward.log" 2>&1 &
  FORWARD_PID=$!
  sleep 3
}

install_chart() {
  helm upgrade --install "${RELEASE}" "$1" --namespace "${NS}" --create-namespace \
    --set postgresql.enabled=true --set postgresql.persistence.size=1Gi \
    --set persistence.size=1Gi --set publicUrl="${BASE}" \
    --set ingress.enabled=true --set ingress.className=traefik --set ingress.host="${HOST}" \
    --wait --timeout 10m >"${WORK}/helm.log"
}

# --- cluster, ingress controller, two chart versions
if ! kind get clusters 2>/dev/null | grep -qx "${CLUSTER}"; then
  kind create cluster --name "${CLUSTER}" --image "${NODE_IMAGE}" --wait 180s
fi
kubectl config use-context "kind-${CLUSTER}" >/dev/null
helm upgrade --install traefik traefik --repo https://traefik.github.io/charts \
  --version "${TRAEFIK_CHART_VERSION}" --namespace traefik --create-namespace \
  --set service.type=ClusterIP --wait --timeout 5m >/dev/null
pass "kind ${CLUSTER} with Traefik ${TRAEFIK_CHART_VERSION}"
helm package "${CHART_DIR}" --version "${FROM}" --app-version "${FROM}" --destination "${WORK}" >/dev/null
helm package "${CHART_DIR}" --version "${TO}" --app-version "${TO}" --destination "${WORK}" >/dev/null

# --- install
install_chart "${WORK}/bemmoly-${FROM}.tgz" || fail "helm install of chart ${FROM} did not become ready"
pass "installed chart ${FROM} (app ${FROM}) with the bundled Postgres"
[ "$(k exec "${RELEASE}-postgres-0" -- psql -U bemmoly -d bemmoly_db -Atc "select extversion from pg_extension where extname = 'vector'")" != '' ] ||
  fail 'pgvector is not installed in the bundled Postgres'
pass 'pgvector extension present'
for key in BEMMOLY_SECRET_KEY BEMMOLY_BACKUP_PASSPHRASE DATABASE_URL POSTGRES_PASSWORD; do
  [ -n "$(secret_value "${key}")" ] || fail "the generated Secret has no ${key}"
done
[ "$(secret_value BEMMOLY_SECRET_KEY | base64 -d | wc -c | tr -d ' ')" = 32 ] || fail 'BEMMOLY_SECRET_KEY is not 32 bytes of base64'
KEY_BEFORE=$(secret_value BEMMOLY_SECRET_KEY)
pass 'generated Secret holds the key, passphrase, database URL and password'
for claim in "${RELEASE}-data" "data-${RELEASE}-postgres-0"; do
  [ "$(k get pvc "${claim}" -o jsonpath='{.status.phase}')" = Bound ] || fail "claim ${claim} is not Bound"
done
pass 'both claims Bound'
probes=$(k get deploy "${RELEASE}-all" -o jsonpath='{range .spec.template.spec.containers[0]}{.startupProbe.httpGet.path} {.readinessProbe.httpGet.path} {.livenessProbe.httpGet.path}{end}')
[ "${probes}" = '/healthz /readyz /healthz' ] || fail "unexpected probes: ${probes}"
[ "$(k get pods -l app.kubernetes.io/component=all -o jsonpath='{.items[0].status.containerStatuses[0].ready}')" = true ] ||
  fail 'the app pod is not Ready'
[ "$(k get pods -l app.kubernetes.io/component=all -o jsonpath='{.items[0].status.containerStatuses[0].restartCount}')" = 0 ] ||
  fail 'the app pod restarted (a probe killed it?)'
pass 'startup, readiness and liveness probes pass with no restarts'

forward_ingress
wait_ready_url
pass "Ingress serves ${BASE}/readyz"
http -o /dev/null -c "${WORK}/cookies" -H "Origin: ${BASE}" -H 'Content-Type: application/json' \
  -d "{\"workspaceName\":\"Chart test\",\"workspaceUrl\":\"${BASE}\",\"name\":\"Chart Admin\",\"email\":\"admin@bemmoly.test\",\"password\":\"$(head -c 18 /dev/urandom | base64)\"}" \
  -w '%{http_code}' "${BASE}/api/v1/setup/admin" | grep -q '^20' || fail 'creating the first admin through the Ingress failed'
pass 'first admin created through the Ingress'
[ "$(collab_status)" != 101 ] || fail '/collab accepted a socket without a session'
[ "$(collab_status -b "${WORK}/cookies")" = 101 ] || fail '/collab did not switch protocols for a signed-in person'
pass '/collab WebSocket upgrades through the Ingress with a session (101) and refuses one without'
helm test "${RELEASE}" --namespace "${NS}" --timeout 3m >/dev/null || fail 'helm test failed'
pass 'helm test (readiness from inside the cluster)'

# --- upgrade to the second chart version
helm upgrade "${RELEASE}" "${WORK}/bemmoly-${TO}.tgz" --namespace "${NS}" --reuse-values --wait --timeout 10m >"${WORK}/helm.log" ||
  fail "helm upgrade to chart ${TO} failed"
k get events --field-selector "involvedObject.name=${RELEASE}-migrate" -o jsonpath='{.items[*].reason}' | grep -q Completed ||
  fail 'the pre-upgrade changeset Job did not complete'
pass "pre-upgrade Job ran the changesets of ${TO}"
[ "$(k exec "deploy/${RELEASE}-all" -- printenv BEMMOLY_VERSION)" = "${TO}" ] || fail "the app is not on ${TO} after the upgrade"
[ "$(secret_value BEMMOLY_SECRET_KEY)" = "${KEY_BEFORE}" ] || fail 'the upgrade replaced BEMMOLY_SECRET_KEY'
k exec "deploy/${RELEASE}-all" -- bemmoly-db status >"${WORK}/db-status" || fail 'bemmoly-db status failed after the upgrade'
forward_ingress
wait_ready_url
[ "$(http -o /dev/null -w '%{http_code}' -b "${WORK}/cookies" "${BASE}/api/v1/me")" = 200 ] ||
  fail 'the session from before the upgrade no longer works'
[ "$(collab_status -b "${WORK}/cookies")" = 101 ] || fail '/collab does not upgrade after the chart upgrade'
pass "upgraded ${FROM} → ${TO}: same Secret, session and data, /collab still upgrades"

# --- uninstall keeps the Secret and the claims; a reinstall adopts them
helm uninstall "${RELEASE}" --namespace "${NS}" --wait >/dev/null
k wait --for=delete pod -l app.kubernetes.io/instance="${RELEASE}" --timeout 120s >/dev/null 2>&1 || true
[ -z "$(k get deploy,statefulset,svc,ingress -o name)" ] || fail 'uninstall left workloads behind'
[ "$(secret_value BEMMOLY_SECRET_KEY)" = "${KEY_BEFORE}" ] || fail 'uninstall removed the Secret'
k get pvc "${RELEASE}-data" "data-${RELEASE}-postgres-0" >/dev/null || fail 'uninstall removed a claim'
pass 'uninstall removed the workloads and kept the Secret and both claims'
install_chart "${WORK}/bemmoly-${TO}.tgz" || fail 'reinstalling over the kept Secret and claims failed'
forward_ingress
wait_ready_url
http "${BASE}/api/v1/setup/status" | grep -q '"initialized":true' || fail 'the reinstall did not find the workspace'
[ "$(http -o /dev/null -w '%{http_code}' -b "${WORK}/cookies" "${BASE}/api/v1/me")" = 200 ] ||
  fail 'the session does not survive a reinstall'
pass 'reinstall adopted the Secret and found the workspace and the session'

helm uninstall "${RELEASE}" --namespace "${NS}" --wait >/dev/null
kubectl delete namespace "${NS}" --wait --timeout 180s >/dev/null
pass 'uninstalled and removed the namespace'

# --- the published chart, upgraded to this one
NS=bemmoly-published
curl -fsSL -o "${WORK}/published.tgz" "https://github.com/bemmoly/bemmoly/releases/download/v${FROM}/bemmoly-${FROM}.tgz" ||
  fail "could not download the chart published with ${FROM}"
kubectl create namespace "${NS}" >/dev/null
pg_password=$(head -c 18 /dev/urandom | base64 | tr -d '/+=')
k create secret generic bemmoly --from-literal="POSTGRES_PASSWORD=${pg_password}" \
  --from-literal="DATABASE_URL=postgres://bemmoly:${pg_password}@db:5432/bemmoly_db" \
  --from-literal="BEMMOLY_SECRET_KEY=$(head -c 32 /dev/urandom | base64)" >/dev/null
k create deployment db --image=pgvector/pgvector:pg18 --port=5432 >/dev/null
k set env deployment/db --from=secret/bemmoly --keys=POSTGRES_PASSWORD POSTGRES_USER=bemmoly POSTGRES_DB=bemmoly_db >/dev/null
k expose deployment db --port=5432 >/dev/null
k rollout status deployment/db --timeout 180s >/dev/null || fail 'the external Postgres did not start'
helm install "${RELEASE}" "${WORK}/published.tgz" --namespace "${NS}" --set publicUrl="${BASE}" \
  --set persistence.size=1Gi --wait --timeout 10m >/dev/null || fail "the published ${FROM} chart did not install"
helm upgrade "${RELEASE}" "${WORK}/bemmoly-${TO}.tgz" --namespace "${NS}" --reuse-values \
  --set existingSecret=bemmoly --wait --timeout 10m >/dev/null || fail 'upgrading the published chart failed'
[ "$(k exec "deploy/${RELEASE}-all" -- printenv BEMMOLY_VERSION)" = "${TO}" ] || fail "the published install is not on ${TO}"
k exec "deploy/${RELEASE}-all" -- bemmoly-health || fail 'the upgraded published install is not healthy'
[ -z "$(k get secret "${RELEASE}-secrets" -o name 2>/dev/null)" ] || fail 'the upgrade generated a Secret beside existingSecret'
pass "the chart published with ${FROM} upgrades to this chart (${TO}) with its own Secret"
kubectl delete namespace "${NS}" --wait --timeout 180s >/dev/null
