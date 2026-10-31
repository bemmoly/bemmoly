# Stage on Cloud Run, Prod on GKE

This guide carries on from [Ship your own project](your-own-project.md) and
[Run an application on GKE](gke.md). Here, two services ship from one definition to Stage on
Cloud Run at zero instances, so Stage costs nothing while nobody uses it, and to Prod on a fresh
GKE Autopilot cluster. Each environment gets its own scaling and health checks, and one service
finds the other by name in both.

Plan on about an hour. Each step says what you should see, so you can tell where something went
wrong.

## What you need

- **Everything from [Ship your own project](your-own-project.md)** working: the project
  attached, and two environments in it. This guide calls them Stage (class Staging) and Prod
  (class Prod).
- **Two services** in the same catalog group, each with a Dockerfile and its own
  `.bemmoly/application.yaml`. This guide calls them `shop`, which calls `cart`. Any two work.
- **kubectl**: `gcloud components install kubectl`.
- **About $0.20 an hour** while the Autopilot cluster runs, plus its pods. Delete it at the end.

```sh
PROJECT=your-project-id
REGION=europe-west1
GROUP=web
```

## 1. Choose where each environment runs

The runtime is chosen per environment, and an application can choose otherwise on its own page.
What each one costs differs: Cloud Run at a minimum of zero instances costs nothing while idle,
and GKE pods are billed for as long as they run.

Create the Prod cluster with the Gateway API, the Secret Manager add-on and its secret sync:

```sh
gcloud container clusters create-auto shop-prod --location "$REGION" --project "$PROJECT"
```

```sh
gcloud container clusters update shop-prod --location "$REGION" --project "$PROJECT" --gateway-api=standard --enable-secret-manager --enable-secret-sync
```

Attach it to Prod on Platform › Clusters, as in step 2 of [the GKE guide](gke.md#2-attach-the-clusters).
Then open Platform › Environments, choose **Edit…** on Prod, and set **Applications run on** to
**Attached cluster**. Leave Stage on **Cloud Run**.

**You should see**, under the choice, one sentence on what it costs, and how many applications
follow the default. An application that chose its own runtime is named there with its choice.

## 2. Say how each environment runs it

Settings live in three places, and the first one that sets a value wins:

1. The application's **Settings** tab in Pipelines, per environment.
2. `deploy.environments.<environment>` in `.bemmoly/application.yaml`.
3. `deploy` in `.bemmoly/application.yaml`.

Anything none of them sets is the runtime's default: Cloud Run starts at zero instances; GKE
runs two pods in a Prod-class environment, with a disruption budget so an Autopilot upgrade
takes one at a time, and one pod elsewhere.

Give `shop` a health check and a smaller Stage:

```yaml
pipeline:
  extends: acme/node-service@3
  deploy:
    port: 8080
    healthcheck: { path: /healthz }
    scaling: { max: 4 }
    environments:
      prod: { scaling: { max: 10 }, resources: { cpu: 1, memory: 1Gi } }
```

| Setting | Cloud Run | GKE |
| --- | --- | --- |
| `scaling.min`, `scaling.max` | Min and max instances | The autoscaler's replica range (never below one) |
| `scaling.concurrency` | Requests one instance takes at once | Not used |
| `scaling.cpuTarget` | Not used | CPU use the autoscaler aims for, in percent (70) |
| `resources.cpu`, `resources.memory` | The container's limits | Requests and limits, which Autopilot bills |
| `port` | The container port | The container port and the in-cluster address |
| `healthcheck.path` | Liveness probe | Liveness probe |
| `healthcheck.ready` | Startup probe (`path` when absent) | Readiness probe (`path` when absent) |
| `secretsAs` | `env` (default) or `files` | `env` (default) or `files` |

Push the change. Open `shop`'s page and its **Settings** tab.

**You should see** one card per environment with its runtime, every setting's value, and where
it came from: **application.yaml**, **application.yaml for prod**, or **Default**. Stage shows
minimum 0 from **Default**; Prod shows minimum 2 and "One pod at a time may go during upgrades".

On Prod, press **Edit**, set **Ready path (readiness)** to `/ready` (or any path your service
answers on once it can take traffic), and save. **You should see** it marked **Set here**. In a
protected environment only the people who may deploy there can change settings.

## 3. Let `shop` find `cart`

On `shop`'s **Variables** tab, add a plain variable for every environment named `CART_URL`.
Use **Insert another application's address** and choose **cart: address in the same
environment**, then add a path after it:

```
${{ apps.cart.url }}/api
```

`${{ apps.cart.url }}` becomes the address services in that environment reach `cart` on: its
`run.app` URL on Cloud Run, and `http://cart.<group>.svc.cluster.local:<port>` on GKE.
`${{ apps.cart.publicUrl }}` becomes the address the internet uses: the front door's domain
where there is one, else the `run.app` URL of a public service or the GKE Gateway's address.

**You should see**, under the value, one line per environment saying `cart` is not deployed
there yet. A deploy of `shop` to an environment where `cart` has never gone fails with that same
sentence, so callees go first.

## 4. Ship both to Stage

Push to both repositories and promote `cart`'s release to Stage, then `shop`'s.

**You should see** both on Cloud Run with no minimum instance count, which means zero:

```sh
gcloud run services describe shop --region "$REGION" --project "$PROJECT" --format='yaml(spec.template.metadata.annotations)'
```

`autoscaling.knative.dev/maxScale: '4'` is there and `minScale` is not. And `CART_URL` filled
in with `cart`'s `run.app` address:

```sh
gcloud run services describe shop --region "$REGION" --project "$PROJECT" --format='yaml(spec.template.spec.containers[0].env)'
```

On `shop`'s **Variables** tab the Stage line under `CART_URL` now shows that address. A `run.app`
address only answers callers with an identity token unless the service is public; set
`public: true` under `deploy` for a service the internet calls.

## 5. Promote both to Prod

Promote `cart`, then `shop`, to Prod and approve them.

```sh
gcloud container clusters get-credentials shop-prod --location "$REGION" --project "$PROJECT"
```

**You should see** an autoscaler and a disruption budget for each revision, and no fixed replica
count on its Deployment:

```sh
kubectl -n "$GROUP" get hpa,pdb
```

The autoscaler's `MINPODS` is 2 and `MAXPODS` 10; the budget's `MAX UNAVAILABLE` is 1. Two `shop`
pods run once the autoscaler has caught up, about fifteen seconds after the first one.

**You should see** the readiness path you set in Pipelines and the health path from the file:

```sh
kubectl -n "$GROUP" get deploy -l app.kubernetes.io/name=shop -o jsonpath='{range .items[*]}{.spec.template.spec.containers[0].readinessProbe.httpGet.path} {.spec.template.spec.containers[0].livenessProbe.httpGet.path}{"\n"}{end}'
```

**You should see** `CART_URL` as `cart`'s in-cluster address, and secrets read from a synced
Secret rather than a value:

```sh
kubectl -n "$GROUP" get deploy -l app.kubernetes.io/name=shop -o jsonpath='{.items[0].spec.template.spec.containers[0].env}'
```

`CART_URL` is `http://cart.web.svc.cluster.local:8080/api`, and each secret is a `secretKeyRef`
to a Secret named after the revision. The stable Service `cart` answers on that address:

```sh
kubectl -n "$GROUP" get svc cart
```

## 6. Canary and roll back in Prod

Push another change to `shop`, let it reach Stage, and promote it to Prod. Then press
**Roll back** on its page. [The GKE guide](gke.md#6-switch-prod-and-watch-a-canary-on-gke) shows
how to read the split.

**You should see** the new revision with its own autoscaler at two pods while it takes a small
share of traffic, then everything back on the previous revision at once.

Three things to know about GKE here:

- The canary's weights live on the Gateway. Callers inside the cluster reach the stable
  Service, which points at the revision taking most traffic, so they see the new release only
  once it takes more than half.
- The two newest revisions that take no traffic are kept for a roll back, each at its autoscaler's
  minimum. In Prod that is two pods each until the next deploy prunes them.
- Secrets as environment variables are copied into a Kubernetes Secret, so they live in the
  cluster too. Set **Secrets as** to **Files** where that is not acceptable.

## 7. Clean up

Delete the cluster, and set Prod back to **Cloud Run** on Platform › Environments:

```sh
gcloud container clusters delete shop-prod --location "$REGION" --project "$PROJECT" --quiet
```

## What to send back

For each step, whether it did what "You should see" says. When it did not, send the sentence the
screen or log showed, and the output of the command beside it.
