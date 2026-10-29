# Run an application on GKE with Pipelines

This guide carries on from [Ship your own project](your-own-project.md). There, one application
ships to Cloud Run in your own project. Here, the same application moves to GKE Autopilot in
Dev, then in Prod, while every other application stays on Cloud Run. You attach clusters you
create yourself, so Pipelines only deploys into them and never changes them.

Plan on about an hour. Each step says what you should see, so you can tell where something
went wrong.

## What you need

- **Everything from [Ship your own project](your-own-project.md)** working: the project
  attached, Dev and Prod in it, and the application reaching Prod on Cloud Run.
- **kubectl**, to look inside the clusters: `gcloud components install kubectl`.
- **About $0.20 an hour** while the two clusters run, plus their pods. GKE charges a cluster
  management fee of $0.10 an hour each; its free tier covers one Autopilot cluster per billing
  account. Delete the clusters at the end.

Set the same variables as before, plus the application and the catalog group it belongs to.
The group's key is the namespace Pipelines deploys into.

```sh
PROJECT=your-project-id
REGION=europe-west1
APP=shop
GROUP=web
```

## 1. Create two Autopilot clusters

One cluster per environment keeps Dev and Prod apart. Turn on the GKE API, then create both:

```sh
gcloud services enable container.googleapis.com --project "$PROJECT"
```

```sh
gcloud container clusters create-auto shop-dev --location "$REGION" --project "$PROJECT"
```

```sh
gcloud container clusters create-auto shop-prod --location "$REGION" --project "$PROJECT"
```

Each takes five to ten minutes. Then turn on the Gateway API in both. If it is on already, the
command changes nothing.

```sh
for c in shop-dev shop-prod; do gcloud container clusters update "$c" --location "$REGION" --project "$PROJECT" --gateway-api=standard; done
```

Turn on GKE's Secret Manager add-on too, so pods can read the application's secrets:

```sh
for c in shop-dev shop-prod; do gcloud container clusters update "$c" --location "$REGION" --project "$PROJECT" --enable-secret-manager; done
```

**You should see** `CHANNEL_STANDARD` from:

```sh
gcloud container clusters describe shop-dev --location "$REGION" --project "$PROJECT" --format='value(networkConfig.gatewayApiConfig.channel)'
```

Pipelines acts as your own gcloud sign-in, and Owner or Editor on the project lets it create
namespaces, Deployments, Services and HTTPRoutes there. Nothing else needs granting.

## 2. Attach the clusters

In Pipelines, open Platform › Clusters. Each environment has a row. On **Dev**, press **Attach
a cluster…**. The project and the location are filled in from the environment. Enter `shop-dev`
as the cluster name, leave **Your own Gateway** empty, and press **Attach cluster**.

**You should see** "shop-dev is ready", and on the Dev row: Ready, Attached cluster, your
project and region, and the release channel GKE chose. If it needs something, each problem is
one sentence saying what to turn on or grant. Fix it and press **Check again**.

Do the same on **Prod** with `shop-prod`.

## 3. Switch Dev to GKE

Open the application's page. The **Where it runs** card has one line per environment. Set
**Runtime in Dev** to **Attached cluster**. Leave Prod on **Default: Cloud Run** for now.

**You should see** no warning under Dev. Choose **GKE Autopilot** instead and a warning says
Dev's cluster is an attached cluster: GKE Autopilot and GKE Standard are for clusters
Pipelines creates through a managed connection. Set it back to **Attached cluster**.

You can also name the runtime in `.bemmoly/application.yaml`, as `runtimes: { dev:
attached-cluster }`. A choice made on this card wins over the file, so a switch never needs a
commit; **Default** follows the file, then the environment.

## 4. Push, and watch it reach Dev on GKE

Push any change to the default branch. Fetch the cluster's credentials while it builds:

```sh
gcloud container clusters get-credentials shop-dev --location "$REGION" --project "$PROJECT"
```

**You should see**:

1. The run, the release and the promotion to Dev, as on Cloud Run.
2. A namespace named after the group, with one Deployment and one Service per revision, one
   HTTPRoute named after the application and a Gateway named `bemmoly`:
   `kubectl -n "$GROUP" get deploy,svc,httproute,gateway`
3. The Gateway's address after a few minutes, while Google makes its load balancer:
   `ADDRESS=$(kubectl -n "$GROUP" get gateway bemmoly -o jsonpath='{.status.addresses[0].value}')`
4. Your service answering through it. Routes answer on a host name until the front door gives
   each service a domain:
   `curl -H "Host: $APP.$GROUP.bemmoly.internal" "http://$ADDRESS/"`

Cloud Run still serves Prod.

## 5. Read a secret on GKE

Set a secret for Dev on the application's **Variables** tab, as in step 10 of
[Ship your own project](your-own-project.md#10-secrets), then push and let it reach Dev.

On GKE a secret is a file, not an environment variable. Kubernetes cannot fill a variable from a
file, and Pipelines never puts a value into a Kubernetes Secret. GKE's Secret Manager add-on
mounts each secret at the version the deploy recorded, at `/var/run/secrets/bemmoly/<NAME>`, and
the variable `<NAME>_FILE` holds that path. Plain variables stay ordinary environment variables.
Read `API_KEY` like this in Node:

```js
const apiKey = readFileSync(process.env.API_KEY_FILE, 'utf8');
```

The pods run as a Kubernetes service account named after the application. At each deploy
Pipelines grants that account's Workload Identity principal Secret Manager Secret Accessor on
each secret the revision mounts, and nothing else.

**You should see** the revision's class name the secret by version, with no value:

```sh
kubectl -n "$GROUP" get secretproviderclass -o yaml | grep resourceName
```

```
- resourceName: "projects/<PROJECT>/secrets/bemmoly-shop-API_KEY-dev/versions/1"
```

And the file inside a pod, without printing it. Use the newest Deployment that
`kubectl -n "$GROUP" get deploy` lists, and an image that has a shell:

```sh
kubectl -n "$GROUP" exec deploy/<newest> -- sh -c 'wc -c < "$API_KEY_FILE"'
```

**You should see** the length of what you pasted. If the add-on is off, the deploy fails saying
which command turns it on.

## 6. Switch Prod, and watch a canary on GKE

On the card, set **Runtime in Prod** to **Attached cluster**. Promote the release Dev runs to
Prod. A first deploy into a new cluster takes all its traffic at once, since there is nothing
to compare against. Push another change, let it reach Dev, and promote it to Prod.

**You should see** the rollout start as a canary. The split lives in the route's weights:

```sh
gcloud container clusters get-credentials shop-prod --location "$REGION" --project "$PROJECT"
```

```sh
kubectl -n "$GROUP" get httproute "$APP" -o jsonpath='{range .spec.rules[0].backendRefs[*]}{.name}={.weight}{"\n"}{end}'
```

The new revision has a small weight and the old one the rest. The canary is judged on the load
balancer's numbers in Cloud Monitoring, which arrive a minute or two late. With no traffic there
is nothing to judge, and after a while the rollout pauses to ask you. To have it judged, send
requests during the canary:

```sh
ADDRESS=$(kubectl -n "$GROUP" get gateway bemmoly -o jsonpath='{.status.addresses[0].value}')
for i in $(seq 900); do curl -s -o /dev/null -H "Host: $APP.$GROUP.bemmoly.internal" "http://$ADDRESS/"; sleep 1; done
```

## 7. Roll back

Press **Roll back** on the application's page.

**You should see** the route send everything to the previous revision at once: the command from
step 6 prints the old revision with weight 100. Its Deployment was never removed. Pipelines
keeps the two newest revisions that take no traffic and prunes older ones on each deploy.

## 8. Switch back and clean up

Set both lines on the card back to **Default: Cloud Run**. The next deploy to each environment
goes to Cloud Run again; nothing moves until then. Then forget the clusters on Platform ›
Clusters and delete them:

```sh
for c in shop-dev shop-prod; do gcloud container clusters delete "$c" --location "$REGION" --project "$PROJECT" --quiet; done
```

## What to send back

For each step, whether it did what "You should see" says. When it did not, send the sentence
the screen or log showed, and `kubectl -n "$GROUP" get events` if the cluster was involved.
Things worth trying on purpose:

- **Attach a cluster with the Gateway API off**, or in a project your sign-in cannot see. You
  should get one sentence saying what to turn on or grant.
- **Switch a runtime during a canary.** The canary should finish where it started.
- **Delete shop-dev in Google Cloud, then push.** The deploy should fail saying the cluster was
  not found, and where to check it.

Known gaps: switching between Cloud Run and GKE is not a traffic move yet, so the first deploy
on the new runtime takes all its traffic at once; the front door does that move later.
Secrets are files, not environment variables. Creating clusters through a managed connection
is built but has not run against a real organization.
