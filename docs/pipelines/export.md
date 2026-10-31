# Export what Pipelines made as Terraform and Helm

Pipelines never locks you in. Everything it created or deployed through a connection exports
as Terraform and Helm you can run yourself: the projects and identities of a managed landing
zone, the shared registry, secrets (never their values), each Cloud Run service at the release
serving it, the GKE clusters Pipelines created and what it deploys into them, each
environment's front door, and the runner pools it starts build machines in.

This guide exports the project you attached in [Ship your own project](your-own-project.md)
(and the clusters from [Run an application on GKE](gke.md), the front door from
[Move an application between Cloud Run and GKE](front-door.md) and the pools from
[Build machines](build-machines.md), if you did those), then proves the
export matches what runs: Terraform adopts it with no changes, and Helm renders the same objects.
Plan on half an hour. Each step says what you should see.

## What you need

- **Everything from [Ship your own project](your-own-project.md)** working: a project attached,
  and an application that reached Dev or Prod on Cloud Run. A managed landing zone from
  [Let Pipelines create your Google Cloud projects](managed-mode.md) works the same way.
- **Terraform 1.7 or later** (`terraform version`) and **Helm 3 or later** (`helm version`).
- **gcloud** signed in with application default credentials, as before. Terraform uses them.
- **Platform admin** in Pipelines. Export names every project, identity and secret, so it is a
  platform admin's, like every cloud change.

```sh
PROJECT=your-project-id
REGION=europe-west1
APP=shop
```

## 1. Look at the export

Open **Platform › Export**.

**You should see** one card per connection, such as "My Google Cloud", with the files it holds
(`README.md`, `terraform/versions.tf`, `terraform/cloud-run.tf`, `terraform/imports.tf` and the
rest), **Before you plan** when a value needs filling in, and **Left out**, which always names
revision history, the weights of a canary or a move between runtimes while one is under way,
and secret values.

## 2. Download it

Choose **Download export**.

**You should see** "Downloading bemmoly-pipelines-export-DATE.zip", and the zip in your
downloads. Unzip it somewhere outside any repository:

```sh
mkdir -p ~/bemmoly-export && cd ~/bemmoly-export && unzip ~/Downloads/bemmoly-pipelines-export-*.zip
```

**You should see** a `README.md` and one directory per connection, such as `my-google-cloud/`,
with `terraform/` inside, and `helm/` when anything runs on GKE.

Check that no secret value came with it. Use the value you set for `API_KEY` in step 10 of the
first guide:

```sh
grep -r "the-value-you-pasted" . || echo "no secret value"
```

**You should see** `no secret value`.

## 3. Initialise Terraform

```sh
cd my-google-cloud/terraform
cat terraform.tfvars
```

**You should see** `projects` naming your project, and `project_numbers` with its number when
Pipelines could read it. If the card listed anything under **Before you plan**, fill those values
in now; each line says which command prints the value.

```sh
terraform init
```

**You should see** "Terraform has been successfully initialized!", and a
`.terraform.lock.hcl` pinning the Google provider to one 8.x build.

## 4. Plan against the live project

```sh
terraform plan
```

**You should see** `Plan: N to import, 0 to add, 0 to change, 0 to destroy.`, with N the number
the directory's README states. Each import is something that exists already: the Cloud Run
service, its public invoker grant when it is public, the secret, and who may read it.

Anything under "to add" would be created twice and anything under "to change" means the export
does not match what runs. Do not apply then; send back the plan (see the end).

## 5. Adopt it

```sh
terraform apply
```

**You should see** `Apply complete! Resources: N imported, 0 added, 0 changed, 0 destroyed.`
Nothing in Google Cloud changes; Terraform only records what is there. Plan again:

```sh
terraform plan
```

**You should see** `No changes. Your infrastructure matches the configuration.`

The import blocks in `imports.tf` do nothing from now on, and you may delete them. Keep
deploying with Pipelines while you test: traffic is ignored in `cloud-run.tf`, so a canary or a
roll back never shows as drift. A new release does change the image, so plan again after a deploy
and expect the image digest to differ.

Delete the state when you are done testing, so nothing in it outlives the test:

```sh
rm -rf .terraform terraform.tfstate*
```

## 6. Check the front door and the runner pools

Only if an environment has its front door turned on, or a runner pool runs on GKE Autopilot.

```sh
grep -c '^resource' front-door.tf build-pools.tf
```

**You should see** a count for each file. `front-door.tf` declares, per environment and
project, the address, forwarding rule, proxy, URL map with a host per application, a backend
service per runtime, Cloud Run's serverless endpoint groups, the health check and, with a
domain, a managed certificate per host. GKE's zonal endpoint groups are read with `data`
blocks, since GKE makes them itself. `build-pools.tf` declares an Autopilot pool's cluster when
Pipelines made it, and the binding that lets its pods act as the pool's service account.

Step 4's plan covers both. A host still shifting between runtimes is exported with all its
traffic on the backend that takes most now, and Before you plan names it; plan again once the
move ends.

## 7. Render the Helm charts

Only if you followed [Run an application on GKE](gke.md). One chart per catalog group, with a
values file per application per environment:

```sh
cd ../helm
GROUP=web
helm lint "$GROUP" -f "$GROUP/values/dev/$APP.yaml"
```

**You should see** `1 chart(s) linted, 0 chart(s) failed`.

```sh
helm template "$APP" "$GROUP" -n "$GROUP" -f "$GROUP/values/dev/$APP.yaml"
```

**You should see** a Deployment and a Service named after the serving revision, the HTTPRoute
sending all its traffic to that revision, and, when the application has secrets, its
ServiceAccount and a SecretProviderClass naming each secret at its version.

Compare it with what runs, against the Dev cluster:

```sh
gcloud container clusters get-credentials shop-dev --location "$REGION" --project "$PROJECT"
helm template "$APP" "$GROUP" -n "$GROUP" -f "$GROUP/values/dev/$APP.yaml" | kubectl diff -f -
```

**You should see** only `app.kubernetes.io/managed-by` change from `bemmoly-pipelines` to
`Helm`, plus whatever Kubernetes fills in itself. To hand the objects to Helm for real, the
directory's README has the `kubectl label` and `annotate` commands to run first; Pipelines no
longer deploys an application once Helm owns it.

An Autopilot runner pool has its own chart, `runner-pools`, with a values file per pool:

```sh
POOL=gke-runners
NAMESPACE=bemmoly-runners-gke-runners
helm template "$POOL" runner-pools -n "$NAMESPACE" -f "runner-pools/values/$POOL.yaml"
```

**You should see** the pool's Namespace and the `bemmoly-runner` ServiceAccount, annotated with
the Google service account its pods act as. The directory's README names each pool's namespace.

## 8. Export one application

Open the application's page in Pipelines and choose **Export** at the top.

**You should see** "Downloading bemmoly-pipelines-export-shop-DATE.zip". The zip holds only this
application's services, secrets and Helm values, with no landing zone.

## What is left out, and why

- **Revision history.** Cloud Run and GKE keep earlier revisions so Pipelines can roll back. The
  export holds only the revision serving traffic.
- **The canary's weights.** Terraform ignores Cloud Run's traffic, and each HTTPRoute sends all
  traffic to the serving revision. When a deploy is moving, Before you plan says so.
- **A move's weights in flight.** While an application moves between runtimes, its front door
  host is exported with all its traffic on the backend that takes most now.
- **GKE's zonal endpoint groups.** GKE makes them from each revision's Service annotation, which
  the Helm values keep, so Terraform reads them rather than declaring them.
- **Secret values.** They live only in Secret Manager. The export names each secret and the
  version each service reads.
- **The workload identity federation pool and the control project.** `bootstrap.sh` made them,
  so they are yours already.
- **Build machines.** A Cloud Build pool leaves nothing behind to import, and an Autopilot
  pool's job pods and warm room start and stop with its jobs; `terraform/build-pools.tf` lists
  how each pool starts them.

## What to send back

For each step, whether it did what "You should see" says. When a plan shows anything to add or
change, send the plan's lines for that resource. The likeliest places are the Cloud Run
service's CPU and memory, its startup probe, a budget, a GKE cluster, and the front door's
backend services and URL map, whose plans Google fills in with values Pipelines never set.
