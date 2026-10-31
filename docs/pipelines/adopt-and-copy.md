# Adopt Stage as it runs, copy it to a fresh Prod

This guide is for a Stage that already runs on Cloud Run, deployed by hand or by another CI, with
its variables and secrets set in the Cloud Run console, and a Prod that does not exist yet. Here,
Pipelines adopts Stage's services as they run, without changing anything in Google Cloud, then
copies their configuration to a fresh Prod on GKE Autopilot.

It carries on from [Ship your own project](your-own-project.md) and
[Stage on Cloud Run, Prod on GKE](stage-and-prod.md). Plan on about an hour.

Adopting and copying have run against recorded Google Cloud answers and the simulator only, not
yet against a live project. Each step says what you should see, so you can tell where something
went wrong; please send back what you saw.

## What you need

- **Stage's project attached** on Platform › Clouds, and a Stage environment (class Staging) in
  it, as in [step 5 of Ship your own project](your-own-project.md#5-make-somewhere-to-deploy).
  Its region must be the region the services run in.
- **The services in the catalog**, each named as its Cloud Run service is. A service with another
  name can be matched by hand.
- **A Prod environment** (class Prod) in its own attached project, with nothing deployed yet.
- **Secrets in Secret Manager**, referenced from the services. A secret in another project needs
  that project attached too.
- **kubectl**: `gcloud components install kubectl`.
- **About $0.20 an hour** while the Autopilot cluster runs, plus its pods.

```sh
STAGE=your-stage-project
PROD=your-prod-project
REGION=europe-west1
GROUP=web
```

## 1. See what adopting would import

Note each service's generation, to check later that nothing changed:

```sh
gcloud run services list --project "$STAGE" --region "$REGION" --format='table(metadata.name,metadata.generation,status.url)'
```

Open Platform › Environments, and on Stage's row choose **···** › **Adopt services…**.

**You should see** every service from that list, each as a card: the application it matches by
name, **Release zero** with the image it runs by digest, every variable, and its settings
(minimum and maximum instances, requests per instance, CPU, memory, port and probe paths). A
secret shows where it lives and its version, never a value; `latest` is shown as the number it
points at now. A service whose name matches no application says so; choose one under **As
application**, or leave it unticked to skip it.

**You should see**, under a variable holding another service's `run.app` address, a ticked
**Use `${{ apps.<key>.url }}`**. Keep it: each environment then fills in where that application
runs there, so Prod later gets its in-cluster address.

## 2. Adopt them

Press **Adopt N services**.

**You should see** "Adopted N services". On each application's page:

- **Variables**: Stage's values, the addresses as references, and each secret as its project and
  name in Secret Manager.
- **Settings**: Stage's values marked **Set here**.
- **Releases**: `0.0.0-adopted.<stage key>`, the image the service ran.

**You should see** the same generation as before for every service, since adopting changes only
Pipelines:

```sh
gcloud run services list --project "$STAGE" --region "$REGION" --format='table(metadata.name,metadata.generation)'
```

A service with the same name as an application, which nobody adopted, is never replaced: the
first deploy of that application to Stage stops with "A Cloud Run service called … already runs
in …, deployed outside Pipelines: adopt it first, or rename the application".

## 3. Roll Stage forward from release zero

Push a change to one of the services and let it reach Stage.

**You should see** the deploy start from the adopted revision: the deployment's page names
release zero as the one before it, and **Roll back** returns to it. In Cloud Run, both revisions
are there:

```sh
gcloud run revisions list --project "$STAGE" --region "$REGION" --service your-service
```

## 4. Make Prod run on GKE Autopilot

Open Platform › Environments, choose **Edit…** on Prod, and set **Applications run on** to
**GKE Autopilot**. On Platform › Clusters, create Prod's cluster, as in
[the GKE guide](gke.md#2-attach-the-clusters), and wait until it says it is running.

## 5. Copy Stage to Prod

On Prod's row choose **···** › **Copy configuration…**, and **Copy from** Stage.

**You should see**, for each application, "Cloud Run to GKE Autopilot", then every item that
differs, each with a tick:

- **Variables** before and after. A reference stays a reference.
- **Secrets**, each set to **Needs a value**, with a note that Prod secrets are often different.
  Choose **Copy value** for one that is the same in Prod: Pipelines reads the value once, in
  memory, writes it as a new secret in Prod's project, and grants Prod's pods read access. It is
  never stored or logged.
- **Settings** as the value Prod's next deploy would use, before and after. **Requests per
  instance** is dropped, since GKE has no such setting. **Minimum instances or pods** is
  unticked: Prod keeps its default of 2 unless you tick it.

Press **Copy N items**. **You should see** "Copied N items to Prod". Open it again: **You should
see** only what you left unticked, and **Copy 0 items** greyed out. Each copy is a line on What
changed.

The runtime choice, addresses and deployments are never copied.

**You should see** each secret you copied as a new secret in Prod's project, readable by the
application's pods:

```sh
gcloud secrets list --project "$PROD" --filter='name~bemmoly-'
```

```sh
gcloud secrets get-iam-policy bemmoly-your-service-YOUR_SECRET-prod --project "$PROD"
```

The policy names `roles/secretmanager.secretAccessor` for a `principal://…/ns/$GROUP/sa/your-service`
member.

## 6. Give Prod its own secrets

**You should see** each secret you left as it was marked **Needs a value** in the application's
Variables. Promote that application to Prod before setting it: **You should see** the deploy stop
with "…'s NAME needs a value in prod: set it in Variables, then deploy".

Choose **Set value…** on each, give Prod's value, and save.

## 7. Promote to Prod

Promote the services Prod calls first, then their callers, and approve them.

```sh
gcloud container clusters get-credentials your-prod-cluster --location "$REGION" --project "$PROD"
```

**You should see** two pods at least behind each autoscaler, not Stage's zero:

```sh
kubectl -n "$GROUP" get hpa
```

**You should see** each address as the other service's in-cluster address, and each secret read
from a synced Secret rather than a value:

```sh
kubectl -n "$GROUP" get deploy -l app.kubernetes.io/name=your-service -o jsonpath='{.items[0].spec.template.spec.containers[0].env}'
```

An address reads `http://<service>.<group>.svc.cluster.local:8080…`, and each secret is a
`secretKeyRef` to a Secret named after the revision.

## What to send back

For each step, whether it did what "You should see" says. When it did not, send the sentence the
screen or log showed, and the output of the command beside it.
