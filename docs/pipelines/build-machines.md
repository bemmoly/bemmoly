# Build machines: run jobs on Google Cloud Build or GKE Autopilot

[Ship your own project](your-own-project.md) runs every job on a runner you start on your
laptop. This guide removes the laptop. A runner pool that runs on Google Cloud Build starts one
build per job: the build runs the runner image for that one job, reports back and ends. Nothing
runs while no job waits, so an idle pool costs nothing. A pool on GKE Autopilot does the same
with one pod per job on a cluster in your CI project; its steps start at
[Runner pools on GKE Autopilot](#runner-pools-on-gke-autopilot).

Do [Ship your own project](your-own-project.md) first, up to step 8. This guide uses the same
`PROJECT`, `REGION` and tunnel, and keeps the `linux-x64` pool from its step 7.

Plan on about 30 minutes. Each step says what you should see.

## How it works

1. A job becomes ready in a Cloud Build pool.
2. Within a few seconds Pipelines starts a build in the pool's project, as the pool's build
   service account, with one step: the runner image in one-job mode.
3. The runner registers with a one-time token made for that job alone. The token reaches the
   build as a substitution read into the step's environment, never in its arguments. It works
   once, and the runner it makes stops working when the job ends.
4. The runner runs the job's steps as containers on the build's Docker daemon, reports the
   result and exits, which ends the build.

A pool never has more builds at once than its most builds. Jobs past that wait in the queue.
Cancelling a run cancels its build. A build that ends before its job reports back fails the job
with Google's reason.

## 1. Turn on Cloud Build and make the build service account

Turn on the Cloud Build API:

```sh
gcloud services enable cloudbuild.googleapis.com --project "$PROJECT"
```

Make the service account builds run as:

```sh
gcloud iam service-accounts create bemmoly-builder --display-name="Bemmoly builds" --project "$PROJECT"
```

```sh
BUILDER="bemmoly-builder@$PROJECT.iam.gserviceaccount.com"
```

Let it write build logs, pull the runner image and push the images your pipelines build:

```sh
gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$BUILDER" --role=roles/logging.logWriter
```

```sh
gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$BUILDER" --role=roles/artifactregistry.writer
```

Bemmoly signs in as you in this test, and a project Owner may already start builds and act as
the service account. When Bemmoly signs in as its own service account instead, give that
account these two grants, with its email in `BEMMOLY`:

```sh
gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$BEMMOLY" --role=roles/cloudbuild.builds.editor
```

```sh
gcloud iam service-accounts add-iam-policy-binding "$BUILDER" --member="serviceAccount:$BEMMOLY" --role=roles/iam.serviceAccountUser --project "$PROJECT"
```

**You should see** `bemmoly-builder` under IAM & Admin › Service accounts.

## 2. Build and push the runner image

The runner image has a `cloud-build` target. It runs as root, because a build step cannot join
the Docker socket's group, and keeps its files in `/workspace`. Make a repository for it, then
build and push it from the repository root:

```sh
gcloud artifacts repositories create bemmoly --repository-format=docker --location="$REGION" --project="$PROJECT"
```

```sh
RUNNER="$REGION-docker.pkg.dev/$PROJECT/bemmoly/runner:dev"
```

```sh
docker build -f apps/runner/Dockerfile --target cloud-build --platform linux/amd64 -t "$RUNNER" .
```

```sh
docker push "$RUNNER"
```

**You should see** the push end with a `digest: sha256:…` line, and the image under Artifact
Registry › bemmoly.

## 3. Move the pool to Cloud Build

In Platform › Capacity, open the `linux-x64` row's menu and choose **Change where it runs…**.
Choose **Google Cloud Build** and fill in:

| Field | Value |
| --- | --- |
| Project | your project |
| Region | your region; it starts as the connection's |
| Runner image | the `RUNNER` address from step 2 |
| Build service account | the `BUILDER` email from step 1 |
| Machine type | Cloud Build's default |
| Most builds at once | 4 |

Press **Save pool**. A new pool works the same way: **Add runner pool**, then **Google Cloud
Build**. Pipelines that name no pool run in `linux-x64`, so moving it moves every job.

**You should see** the row say `Google Cloud Build · <region> · <project>` and `0 of 4 builds`,
and a **Builds now** panel saying there are no builds right now.

Stop the laptop runner from the other guide with Ctrl+C, so it cannot take the job first.

## 4. Push, and watch the job run on Cloud Build

Push a change to the default branch.

**You should see**:

1. In Capacity, a row in **Builds now** for the build job, starting, then running, with a
   **Build log** link. The pool says `1 of 4 builds`.
2. In the Cloud Build console (History, in your region), a build tagged `bemmoly`,
   `pool-linux-x64` and `job-<id>`, running your runner image as its only step. Its
   substitutions hold `_BEMMOLY_LAUNCH_TOKEN`; the step's arguments hold no token.
3. On the run's page, the job's log panel with a **Build log** link to that build.
4. The run passing, the build ending as Successful, and Builds now empty again: `0 of 4 builds`.
5. The release and the promotion to Dev, as before.

## What to send back

For each step, whether it did what "You should see" says. When it did not, send the sentence
the screen showed, the run's log, and the Cloud Build log. Things worth trying on purpose:

- **Cancel the run while its build starts.** The build should end as Cancelled within a minute.
- **Set the build service account to one that does not exist.** The next job should fail with
  Google's sentence, and the pool's row should show it in amber.
- **Set Most builds at once to 1 and start two runs.** One build runs; the other job waits and
  says it waits for a build machine.

## What works on Cloud Build, and what is not tested yet

Everything here is tested against recorded Cloud Build answers and a simulated cloud only. None
of it has run on a real project yet.

- **Steps as containers.** A build step has the Docker socket but no host folder Pipelines can
  name, so the runner starts each step container with the runner container's own volumes
  (`--volumes-from self`) and runs it in the job's folder under `/workspace`. Steps run in that
  folder, not in `/workspace` itself, so a step that names `/workspace` by path sees the folder
  above its check out. Not yet tested: whether a build step's host name is its container id,
  which `self` relies on. If steps fail with "No such container", that is the cause.
- **Image builds.** The runner runs `docker build` against the build's Docker daemon, which
  reads the context from the runner. This should work as it does on a laptop.
- **Image pushes.** The push uses the Docker credentials in the build step. Cloud Build sets up
  credentials for Artifact Registry in its own project; whether the runner's Docker sees them
  is not yet tested.
- **Who a step can act as.** The runner runs on Cloud Build's network and can reach the build
  service account's credentials. Step containers run on Docker's default network; whether they
  can reach those credentials is not yet tested. Give the build service account only the
  grants in step 1.
- **Pull requests from forks** never start a build: their code could reach the build's service
  account. Send them to a pool of machines you start. A fork's job gets no secrets either way.
- **Time.** A build may run for the job's timeout plus 15 minutes, to start. A build that waits
  in Cloud Build's queue for more than 30 minutes gives up and its job waits for another.
- **Bemmoly must be reachable** from Google Cloud at its public address, the tunnel here.

## Runner pools on GKE Autopilot

A pool on GKE Autopilot starts one pod per job on an Autopilot cluster in your CI project. The
pod runs the runner for that one job, with each step in its own image beside it, and ends with
the job. With no job waiting the pool has no pods, so it scales to zero. **Fewest runners**
keeps room for that many pods warm on the cluster's nodes, so a job's pod need not wait for a
new node.

This part uses the same `PROJECT`, `REGION`, `BUILDER` and tunnel as the Cloud Build steps
above, and the `linux-x64` pool. Plan on about 45 minutes, most of it the cluster starting.

### How it works on Autopilot

1. Within a minute of the pool being saved, Pipelines prepares it. It finds the Autopilot
   cluster you named, or, in a CI project Pipelines made, creates it. Then it writes the
   namespace `runners-<pool>`, the Kubernetes service account `bemmoly-runner` there, and a
   Workload Identity binding that lets that account act as the pool's Google service account.
2. A job becomes ready. Pipelines creates a Kubernetes Job in the namespace with one pod: the
   runner, one container for each image the job's steps run in, and a Kaniko container when
   the job builds an image. The launch token is in a Secret the Job owns. It works once.
3. The runner checks out the commit and hands each step to the container for its image, through
   a folder the containers share. Image builds go to the Kaniko container, which pushes with the
   pod's Google identity.
4. The runner reports the result and exits. The step containers stop with it, the pod ends, and
   GKE deletes the Job and its Secret ten minutes later.
5. With fewest runners above 0, Pipelines keeps a Deployment of pause pods, each the size of a
   runner pod, at the lowest priority. A job's pod takes the place of one, and a new one waits
   for room. While pods run, fewer pause pods are kept, so fewest counts both.

### Why one job per pod

A long-lived runner registered with the pool's token would run job after job in one pod. Files,
processes and credentials one job leaves behind would reach the next, and a pull request could
read what a deploy left. With one pod per job, a pod holds one job's token and secrets, starts
clean and is deleted after. The cost is the time a pod takes to start, which fewest runners
shortens. Pull requests from forks still never start a pod, since their code could act as the
pool's service account.

### Steps without a Docker daemon

Autopilot allows no privileged pods, so there is no Docker daemon and no Docker in Docker.
Every container a job needs is in its pod from the start, and image builds use Kaniko, which
needs no daemon.

| | Machines you start | Cloud Build | GKE Autopilot |
| --- | --- | --- | --- |
| Step in its `image:` | container on your Docker | container on the build's Docker | container in the pod, one per image |
| Step that runs `docker` itself (`docker run`, Compose, Testcontainers) | works | works | does not work: no daemon |
| `bemmoly/build` | `docker build` | `docker build` | Kaniko, beside the runner |
| Build for another platform | `--platform` | `--platform` | refused: the nodes are `linux/amd64` |
| Images in one job | any | any | at most 8 |
| Size | the machine | the machine type | each step image's container asks for the pool's vCPU and memory |
| Disk | the machine's | the build's | 4 GiB shared, 1 GiB per step image, 3 GiB for Kaniko |

### 5. Make the cluster

On a CI project Pipelines made, skip this step: tick **Create the cluster if it is missing** in
step 7 and Pipelines creates it.

On a project you attached, make an Autopilot cluster:

```sh
gcloud services enable container.googleapis.com --project "$PROJECT"
```

```sh
gcloud container clusters create-auto bemmoly-runners --location "$REGION" --project "$PROJECT"
```

**You should see** `bemmoly-runners` under Kubernetes Engine › Clusters, with Mode Autopilot and
Status Running. It takes several minutes.

### 6. Let the pods act as the build service account, and build the runner image

The pods act as `BUILDER` from step 1, which can already write logs and push images. Bemmoly
signs in as you in this test; a project Owner may create namespaces and Jobs in the cluster and
set the Workload Identity binding. When Bemmoly signs in as its own service account instead,
give it these two grants:

```sh
gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$BEMMOLY" --role=roles/container.admin
```

```sh
gcloud iam service-accounts add-iam-policy-binding "$BUILDER" --member="serviceAccount:$BEMMOLY" --role=roles/iam.serviceAccountAdmin --project "$PROJECT"
```

The runner image has a `gke` target. It carries the step agent the other containers run. Build
and push it from the repository root:

```sh
RUNNER_GKE="$REGION-docker.pkg.dev/$PROJECT/bemmoly/runner-gke:dev"
```

```sh
docker build -f apps/runner/Dockerfile --target gke --platform linux/amd64 -t "$RUNNER_GKE" .
```

```sh
docker push "$RUNNER_GKE"
```

**You should see** the push end with a `digest: sha256:…` line.

### 7. Move the pool to GKE Autopilot

In Platform › Capacity, open the `linux-x64` row's menu and choose **Change where it runs…**.
Choose **GKE Autopilot** and fill in:

| Field | Value |
| --- | --- |
| Project | your project |
| Region | your region |
| Cluster | `bemmoly-runners` |
| Runner image | the `RUNNER_GKE` address from step 6 |
| vCPU per runner | 2 |
| Memory per runner, GiB | 8 |
| Use Spot capacity | off |
| Pod service account | the `BUILDER` email from step 1 |
| Fewest runners | 0 |
| Most runners at once | 4 |
| Image builder | empty, for Kaniko |

Press **Save pool**, and stop any laptop runner with Ctrl+C.

**You should see** the row say `GKE Autopilot · <region> · bemmoly-runners` and `0 of 4 pods`,
with a spinner and `Preparing the cluster` (or GKE's own words, such as `Creating Autopilot
cluster bemmoly-runners in <project>`) under its name. Within a minute of the cluster running,
the spinner goes and the row says `0 running · 0 starting · 0 warm`.

Check what Pipelines wrote:

```sh
gcloud container clusters get-credentials bemmoly-runners --location "$REGION" --project "$PROJECT"
```

```sh
kubectl get serviceaccount bemmoly-runner -n runners-linux-x64 -o jsonpath='{.metadata.annotations}'
```

**You should see** `iam.gke.io/gcp-service-account` set to the `BUILDER` email.

### 8. Watch the pool go from zero to N and back

Keep the pods in view in a second terminal:

```sh
kubectl get pods -n runners-linux-x64 --watch
```

Push a change to the default branch.

**You should see**:

1. In Capacity, the row say `1 starting`, then `1 running`, and `1 of 4 pods`. **Builds now**
   lists the job with a **Pod in GKE** link.
2. In the terminal, a pod `bemmoly-<job id>-<6 characters>-<5 characters>` go from `Pending`
   through `Init` to `Running`, then `Completed`.
3. The run passing, and the row back to `0 running · 0 starting · 0 warm` and `0 of 4 pods`.
   Nothing else runs in the namespace. That is zero.

Now start four runs at once: push to four branches, or start four runs with **Run pipeline**.

**You should see** four pods at once, `4 of 4 pods` with the row in amber at its limit, and a
fifth run waiting with "Waits for a build machine in linux-x64". As each job ends its pod ends,
and the row comes back to zero.

Set **Fewest runners** to 2 and save.

**You should see** within a minute:

```sh
kubectl get deployment bemmoly-warm-room -n runners-linux-x64
```

answer `2/2`, and the row say `2 warm`. Start one run: its pod should start faster than before,
and the row say `1 running` and `1 warm` until the job ends. Set **Fewest runners** back to 0,
and the Deployment goes within a minute.

### What to send back for Autopilot

For each step, whether it did what "You should see" says. When it did not, send the sentence the
screen showed, the run's log, and the output of:

```sh
kubectl describe pod -n runners-linux-x64
```

Things worth trying on purpose:

- **Name a cluster that does not exist** on an attached project. The row should say so in amber.
- **Set the runner image to one that does not exist.** The job should fail with "GKE could not
  pull …" within a minute or two, and its pod should go.
- **Tick Use Spot capacity.** Pods should run on Spot nodes
  (`kubectl get pod -o jsonpath='{.spec.nodeSelector}'`).
- **A pipeline with a `bemmoly/build` step that pushes.** Its image should land in Artifact
  Registry and its release record the digest.

### What works on Autopilot, and what is not tested yet

Everything here is tested against recorded GKE, IAM and Kubernetes answers and a simulated cloud
only. None of it has run on a real cluster yet. The step agent is tested under BusyBox, dash and
bash.

- **Native sidecars.** Step containers start before the runner and stop when it exits, which
  needs GKE 1.29 or later. On an older cluster the pod would never end on its own.
- **Kaniko's push** uses the pod's Google identity through Workload Identity. Whether Kaniko's
  own credential helper picks it up for Artifact Registry is not yet tested. Kaniko's upstream
  project is archived; the default image is its last release. Set **Image builder** to a
  maintained fork when you have one.
- **What pods ask for.** Autopilot may raise a container's ask to its minimum, and bills by the
  ask. Each step image's container asks for the pool's size, so a job whose steps use two images
  costs twice as much as one with one image. A job whose pod would ask for more than 28 vCPU or
  80 GiB in all, or hold more than 8 images, fails with a sentence.
- **Steps that run `docker`**, start services or need privileges cannot run here. Send those
  pipelines to machines you start or to Cloud Build.
- **Step images that run as a non-root user** may not write the workspace, which the runner
  checks out as root. This is the same on Cloud Build.
- **Spot pods** that Google takes back fail their job with GKE's reason; the job is not retried.
- **Warm room** is pause pods at the lowest priority. On a cluster you attached, Pipelines needs
  the right to create a PriorityClass, which is cluster-wide.
- **The cluster stays** when a pool moves to another hosting. Its warm room is removed.
- **Standard clusters** are refused: Autopilot sizes each node to the pods on it.
