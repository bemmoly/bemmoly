# @bemmoly/runner

## 2.0.0

### Minor Changes

- f61eb12: Pipelines can ship to a Google Cloud project you already have. Connect Google Cloud with
  "Use projects I already have", attach a project (Pipelines checks what it can do there and says
  what to grant), create environments that deploy into it, and set the path each tier's releases
  take. A step marked auto-promote now promotes by itself, never to production. When the
  connection names an image registry, runners build for the deploy platform, push the image and
  release it by its digest, and Cloud Run revisions take the application's port, CPU, memory,
  health check and public access. Private repositories check out with a read-only token for that
  repository alone. Bemmoly can sign in to Google Cloud with your own gcloud credentials on a
  laptop install.

  Adds `POST /api/v1/pipelines/environments`, `PATCH` and `DELETE /environments/:key`,
  `PUT /environments/paths/:tier`, `PATCH /clouds/:id`, `POST /clouds/:id/accounts`,
  `POST /clouds/:id/accounts/:accountId/check` and `DELETE /clouds/:id/accounts/:accountId`.
  Schema changeset `0020-pipelines-attached-accounts` adds four columns to `cloud_accounts`;
  it is quick and reversible. Code hosts gain `readToken` in the module contract.

- e1cca21: A runner pool can run on GKE Autopilot. In Platform › Capacity, add a pool or change where one
  runs, choose GKE Autopilot, and name its project, region, cluster, runner image, vCPU and memory
  per runner, Spot or standard capacity, pod service account, fewest and most runners and image
  builder. Pipelines prepares the pool within a minute: it creates the Autopilot cluster in a CI
  project it made when asked, or uses the one named, then writes the pool's namespace, the service
  account its pods run as and a Workload Identity binding to the pod service account. When a job
  waits in the pool, Pipelines starts one pod for it, with the runner, a container for each image
  the job's steps run in, and Kaniko for image builds, and the pod ends with the job. An idle pool
  has no pods. Fewest runners keeps that much room warm on the nodes. The pool's row shows its
  pods running, starting and warm, live, and Builds now links each pod to GKE. Steps that run
  Docker themselves, builds for platforms other than linux/amd64 and pull requests from forks do
  not run on these pools. The runner gains a pod mode, read from `BEMMOLY_RUNNER_POD`, and its
  image a `gke` target.

  `POST /api/v1/pipelines/pools` and `PATCH /pools/:key` take `autopilot`, and pools carry it.
  Schema changeset `0026-pipelines-autopilot-pools` lets a pool's hosting be `gke-autopilot`; it
  is quick and reversible.

- b633399: A runner pool can run on Google Cloud Build. In Platform › Capacity, add a pool or change where
  one runs, choose Google Cloud Build, and name its project, region, runner image, build service
  account, machine type and most builds at once. When a job waits in the pool, Pipelines starts one
  build for it: the runner image in one-job mode, registering with a token that works once for
  that job. Cancelling the run cancels the build, a build that ends before its job reports fails
  the job with Google's reason, and an idle pool runs nothing. Builds now shows every build still
  running with its log, and a job links the build it ran on. Pull requests from forks never start
  a build. The runner gains `--launch-token` and `--volumes-from`, and its image a `cloud-build`
  target. A pool can now switch between machines you start and Cloud Build.

  `PATCH /api/v1/pipelines/pools/:key` takes `hosting` and `cloudBuild`, and `POST /pools` takes
  `cloudBuild`. The runner protocol's `POST /register` takes a `launchToken` in place of a
  `poolToken`. Schema changeset `0023-pipelines-build-machines` adds the
  `pipeline_runner_launches` table, two columns to runner pools and one each to jobs and runners; it is
  quick and reversible.

- 352f57d: Monorepos can describe every application in one file. An optional `.bemmoly/repository.yaml`
  at the repository root holds `defaults` (build, paths, pipeline, labels, group, owner) and an
  optional central list of applications, each with a name, a folder and any field
  `application.yaml` takes. A folder's own `application.yaml` beats its entry in the list, which
  beats the defaults; lists such as `paths` and `labels` add up and anything else is replaced.
  Leaving the list archives an application, the way deleting its file does. An error names the
  file and the field.

  Builds take args: `pipeline.build.args` maps names to values that may use
  `${{ app.name }}`, `${{ app.path }}` and the run's inputs. The runner passes each as a quoted
  `--build-arg`, on Docker and on Kaniko in Autopilot pools. Build args stay in the image
  history, so an arg named like a secret never takes a value from outside the file.

  A push in one application's folder now always wakes it, and a push touching only a shared
  path from the defaults wakes every application that lists it. An application whose pipeline
  neither builds nor deploys is a library: it is checked and makes no release, and its page
  says so. Each application's page shows where its settings come from. Discovery proposes one
  repository file for folders that share a Dockerfile, picked by an ARG or by a compose file,
  and Set up shows it before the pull request opens.

  Schema change 0027 adds `pipeline_applications.settings_sources` and
  `pipeline_discovery_proposals.shared_build`, both nullable. Runners older than this release
  ignore build args, so update runners before relying on them.

### Patch Changes

- Updated dependencies [8837631]
- Updated dependencies [3e92cfe]
- Updated dependencies [f61eb12]
- Updated dependencies [e1cca21]
- Updated dependencies [b633399]
- Updated dependencies [b2734d8]
- Updated dependencies [f3fda87]
- Updated dependencies [2a526c9]
- Updated dependencies [46a8c17]
- Updated dependencies [2f75fa9]
- Updated dependencies [352f57d]
- Updated dependencies [c3649f5]
- Updated dependencies [3bab756]
- Updated dependencies [1030907]
  - @bemmoly/module-pipelines@2.0.0
  - @bemmoly/shared@2.0.0

## 1.6.1

### Patch Changes

- @bemmoly/module-pipelines@1.6.1
  - @bemmoly/shared@1.6.1

## 1.6.0

### Patch Changes

- Updated dependencies [d793d2c]
  - @bemmoly/shared@1.6.0
  - @bemmoly/module-pipelines@1.6.0

## 1.5.0

### Patch Changes

- @bemmoly/module-pipelines@1.5.0
  - @bemmoly/shared@1.5.0

## 1.4.0

### Patch Changes

- Updated dependencies [cfe109d]
- Updated dependencies [50337e9]
  - @bemmoly/shared@1.4.0
  - @bemmoly/module-pipelines@1.4.0

## 1.3.0

### Patch Changes

- Updated dependencies [5dae368]
- Updated dependencies [4fae3da]
- Updated dependencies [d6208c1]
  - @bemmoly/shared@1.3.0
  - @bemmoly/module-pipelines@1.3.0

## 1.2.0

### Minor Changes

- c41a835: Bemmoly Pipelines: build, test, release and deploy, as a separate product on the same
  install. An admin enables the `pipelines` module in Settings › Modules and chooses who may use
  it; its own web app is served at `/pipelines/`, with its own shell, and people who only use
  Work and Docs never see it.

  - **Catalog.** Every application in Domain › Group › Application, with its owning team, tier
    and labels, read from `.bemmoly/application.yaml` in its repository or created by hand, and
    found by scanning connected repositories.
  - **Pipelines on your own runners.** `bemmoly-runner` claims jobs from a pool and runs each
    step as a container (or as a process with `--local`), streams logs live with secrets
    masked, reports JUnit results and keeps artifacts. Runs start from pushes, pull requests,
    merge queues, schedules or Run pipeline…; Re-run failed runs only what failed. A pipeline
    that cannot start fails its run and says why.
  - **Releases and promotions.** A passing build becomes a release; Promote takes it through
    Dev, Staging and Prod regions with gates, approvals by another person, canaries judged on
    metrics that roll a bad release back by themselves, freezes, and one-click roll back. The `local` provider deploys to
    this machine's Docker, with a real canary splitting traffic between two containers.
  - **Bring your CI.** Keep another CI for builds: `bp release create` or the `bemmoly/release`
    GitHub Action registers its image as a release, signed with the workflow's OIDC token or a
    scoped CI token.
  - **For you, the Map, Runs, Insights.** What is yours and in flight, the whole organisation's
    delivery live on one screen (rewind it to any moment in the last day), and DORA measures by
    domain, group and team.
  - **Access.** Roles bound to teams at a scope, owning teams as Maintainers, policies in CEL
    shown as sentences; every refusal says why and whom to ask, and Platform › Access explains
    any decision.
  - **Platform.** Runner pools and capacity, environments, and clouds with landing zones,
    Google Cloud first (tested against recorded responses).

  `pnpm --filter @bemmoly/module-pipelines seed:demo` seeds the Acme demo organisation;
  docs/pipelines/try-it.md walks through all of it. Schema: Pipelines changesets `0001` to
  `0018` create its `pipeline_*` and `cloud_*` tables when the module is enabled; the kernel adds
  `0115` for command line sign-in with a device code. No new configuration keys are required.

### Patch Changes

- Updated dependencies [c41a835]
- Updated dependencies [33f0341]
- Updated dependencies [c41a835]
  - @bemmoly/shared@1.2.0
  - @bemmoly/module-pipelines@1.2.0
