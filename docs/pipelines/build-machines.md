# Build machines: run jobs on Google Cloud Build

[Ship your own project](your-own-project.md) runs every job on a runner you start on your
laptop. This guide removes the laptop. A runner pool that runs on Google Cloud Build starts one
build per job: the build runs the runner image for that one job, reports back and ends. Nothing
runs while no job waits, so an idle pool costs nothing.

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
- **Runner pools on GKE Autopilot** that keep warm runners and scale to zero come later.
