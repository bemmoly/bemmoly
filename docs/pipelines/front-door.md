# Move an application between Cloud Run and GKE with no failed requests

This guide carries on from [Run an application on GKE](gke.md). There, a switch of runtime
waits for the next deploy, and the application's address changes. Here, Prod gets a front
door: one load balancer with a stable address. A switch then becomes a move. The new runtime's
revision starts, traffic shifts to it in steps, and the old runtime is removed only once every
request runs on the new one. You send requests the whole time and count the ones that fail.

Plan on about two hours. Each step says what you should see, so you can tell where something
went wrong.

## What you need

- **Everything from [Run an application on GKE](gke.md)** working: the application on Cloud
  Run in Prod, and `shop-prod` attached as Prod's cluster, **in the same project**. A front
  door lives in the environment's project and cannot reach a cluster in another one.
- **hey**, to send steady traffic: `brew install hey`, or `go install github.com/rakyll/hey@latest`.
  A curl loop works too; both are below.
- **About $0.03 an hour** for the front door's forwarding rule (about $18 a month), plus the
  load balancer's data charges. Turn it off at the end.
- **A domain you control**, if you want HTTPS. Without one the front door answers on its IP
  address over HTTP, which is enough for this test.

Set the same variables as before, plus Prod's key:

```sh
PROJECT=your-project-id
REGION=europe-west1
APP=shop
GROUP=web
ENV=prod
```

## Why one load balancer per environment

A Google Cloud load balancer is billed by its forwarding rule, about $18 a month for each of
the first five in a project, and forwarding rules, URL maps and target proxies each count
against a small per-project quota. A load balancer per application would pay that and use
that quota once per application. One per environment pays it once, and gives each
application a host rule on it, which costs nothing. The limit to know: one HTTPS proxy
presents 15 certificates at most, so with a domain an environment serves 15 applications over
HTTPS. See your project's quotas with:

```sh
gcloud compute project-info describe --project "$PROJECT" --format=json | grep -B1 -A2 -E '"(URL_MAPS|TARGET_HTTPS_PROXIES|SSL_CERTIFICATES|BACKEND_SERVICES)"'
```

## 1. Let Google's health checks reach the cluster

The front door checks GKE pods directly. Google's checkers come from two ranges, and the
cluster's network must let them in. If the GKE Gateway from the last guide answers, a rule
like this exists already; adding it again is harmless:

```sh
gcloud compute firewall-rules create bm-fd-health --project "$PROJECT" --network default --allow tcp --source-ranges 35.191.0.0/16,130.211.0.0/22
```

**You should see** the rule listed, or a message that it exists.

## 2. Turn on Prod's front door

In Pipelines, open Platform › Environments. Under the environments, **Front doors** has one
row per environment. New Prod environments start with one on; Prod from the earlier guides
was made before, so it is off. On **Prod**, press **Turn on…**. Leave **Domain** empty and
press **Save**.

**You should see** "Being made", then "Ready" with an address, and "1 application" or more:
every application released in Prod gets a host. The address is reserved in your project:

```sh
gcloud compute addresses list --global --project "$PROJECT" --filter='name~^bm-fd'
```

```sh
ADDRESS=$(gcloud compute addresses describe "bm-fd-$ENV" --global --project "$PROJECT" --format='value(address)')
```

The application's page shows the address on its **Front door** card, with "Cloud Run 100%".
A new load balancer takes a few minutes to answer. Then, with the application's key as the
Host header:

```sh
curl -s -o /dev/null -w '%{http_code}\n' -H "Host: $APP" "http://$ADDRESS/"
```

**You should see** `200`. A `404` or `502` in the first minutes is the load balancer still
starting; try again.

### With a domain instead

Press **Edit…** on the row, enter a domain such as `prod.example.com` and save. Each
application then answers on `https://<application>.prod.example.com`. Point that name at the
address in your DNS: an A record for `shop.prod.example.com` with `$ADDRESS`. Google issues the
certificate once DNS answers there, which can take an hour. Until then the row lists the
certificate as not issued yet.

```sh
gcloud compute ssl-certificates list --global --project "$PROJECT" --filter='name~^bm-fd'
```

**You should see** `ACTIVE` in the end. Use `https://shop.prod.example.com/` in the commands
below in place of the address and the Host header.

## 3. Send traffic

In a second terminal, start 45 minutes of steady traffic and keep the summary:

```sh
hey -z 45m -q 5 -c 2 -host "$APP" "http://$ADDRESS/" > hey-to-gke.txt
```

Or with curl, writing one status code a line:

```sh
while true; do curl -s -o /dev/null -w '%{http_code}\n' -H "Host: $APP" "http://$ADDRESS/"; sleep 0.1; done > codes-to-gke.txt
```

## 4. Move to GKE

On the application's page, set **Runtime in Prod** on the **Where it runs** card to **Attached
cluster**.

**You should see** the line "Move to Attached cluster planned. Review the plan" under Prod.
Nothing has moved yet. Open it.

**You should see**, before anything starts:

1. **Steps**: deploy on the attached cluster, shift traffic 10%, 50% and 100%, each held ten
   minutes and judged on error rate and p95 against Cloud Run, then remove Cloud Run.
2. **Downtime**: None, with the address callers keep.
3. **Cost per month**: the front door and the cluster on both sides, Cloud Run before, the
   cluster's share after, marked as estimates from list prices on a date. An attached
   cluster's nodes are yours to pay for, so they show as nothing.
4. **Untested**: what has not been proved on a real project yet.

Press **Start the move**. It goes from Deploying to Starting up, then "10% moved". While it
runs, look at what it made:

```sh
gcloud compute network-endpoint-groups list --project "$PROJECT" --filter='name~^fd-'
```

```sh
gcloud compute url-maps describe "bm-fd-$ENV" --global --project "$PROJECT" --format='yaml(pathMatchers[].defaultRouteAction.weightedBackendServices)'
```

**You should see** an endpoint group in each zone the new pods run in, and two weighted backend
services, 10 and 90. The weights follow the screen at 50 and then 100. After the last hold it
says "Moved", and Cloud Run no longer runs the application:

```sh
gcloud run services list --project "$PROJECT" --region "$REGION"
```

The hold is the rollout hold from Settings (`pipelines.rollout.holdMinutes`, ten minutes by
default). Lower it there before starting to make the test quicker.

## 5. Count the failed requests

Stop hey or the loop once the move says "Moved".

```sh
grep -A10 'Status code distribution' hey-to-gke.txt
```

```sh
sort codes-to-gke.txt | uniq -c
```

**You should see** only `200`. Any other code is a request the move lost: send its count, and
the time from the move's screen.

## 6. Move back to Cloud Run

Start the traffic again, into `hey-to-cloud-run.txt` or `codes-to-cloud-run.txt`. On the card,
set **Runtime in Prod** to **Default: Cloud Run**, open the plan and press **Start the move**.

**You should see** the same steps the other way, then "Moved", and only `200` when you count as
in step 5. The application's Deployments are gone from the cluster:

```sh
kubectl -n "$GROUP" get deploy -l "app.kubernetes.io/name=$APP"
```

## 7. Roll back halfway

Start the traffic and a move to the attached cluster once more. At "10% moved", press **Roll
back**.

**You should see** "Rolled back", "Cloud Run 100%" on the **Front door** card, one weighted
backend service in the URL map from step 4, and only `200` when you count. **Pause** and
**Continue** work at any step too; a paused move holds its weights.

## 8. Turn it off

On the **Front doors** row press **Edit…**, turn **Front door on** off and save.

**You should see** the row say Off, and nothing named `bm-fd` left:

```sh
gcloud compute forwarding-rules list --global --project "$PROJECT" --filter='name~^bm-fd'
```

## What to send back

The status code counts from each move, the move's last message, and how long each step took.
When a step did not do what "You should see" says, send the sentence on the screen. Things
worth trying on purpose:

- **Deploy while a move is paused.** The deploy should fail, saying the application is moving
  and to deploy again once the move ends.
- **Turn the front door off during a move.** It should be refused until the move finishes or
  is rolled back.
- **Release a version that fails on GKE, then move it there.** The move should roll back by
  itself at 10%, saying why.

Known gaps: none of this has run against a real project yet. The calls are checked only
against answers written from Google's reference, and the moves against a simulated cloud,
where no request failed. GKE's standalone endpoint groups beside the Gateway's own have not
been tried on a real cluster. The health check asks for `/` on the serving port. Changing the
domain adds the new hosts and leaves the old ones until the front door is turned off and on.
