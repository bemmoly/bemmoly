# @bemmoly/pipelines-web

## 2.0.0

### Minor Changes

- 3e92cfe: Pipelines adopts the Cloud Run services an environment already runs, deployed by hand or by
  another CI, and copies configuration from one environment to another. Adopt services, on an
  environment's row, lists each service in its project and region with the application it matches
  by name and what adopting it would import; looking changes nothing in Google Cloud. Adopting
  imports plain variables as they are, secrets as references to where they already live at their
  pinned version (the value is never read), the scaling, CPU, memory, port and probe paths as that
  environment's deploy settings, and the running image by digest as release zero, so the first
  deploy rolls forward from it and a roll back can return to it. An address of another adopted
  service can become `${{ apps.<key>.url }}`. A first deploy over a Cloud Run service of the same
  name that nobody adopted now stops and says to adopt it first or rename the application.

  Copy configuration plans every item that differs, per application or for all of them, with a
  tick each. Plain variables and references copy as written. A secret is copied store to store
  (read once in memory, written to the target's project, granted to what runs there, never kept)
  or left needing a value, the default for a Prod-class target; a deploy stops until it has one.
  Deploy settings are translated to the target's runtime, dropping what it lacks, and a lower
  minimum than a Prod default starts unticked. The runtime choice, addresses and deployments are
  never copied, copying again shows only what differs, and each copy is on What changed.

  Adds `GET` and `POST /api/v1/pipelines/environments/:key/adoptions`, and `GET` and `POST
/environments/:key/copies`. Schema changeset `0029-pipelines-adopt-copy` lets a release's source
  be `adopted` and lets a secret wait for its value; it is quick and reversible (going back
  removes secrets still waiting for a value).

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

- b2734d8: Pipelines runs one definition differently per environment, so Stage can run on Cloud Run at zero
  instances and Prod on GKE Autopilot. Each application has deploy settings per environment:
  scaling (min and max; concurrency on Cloud Run; a CPU target on GKE), CPU and memory, the port,
  a health path for liveness and a ready path for readiness, and whether secrets arrive as
  environment variables or files. A value set on the application's Settings tab wins over
  `deploy.environments.<key>` in `.bemmoly/application.yaml`, then the file's `deploy`, then the
  runtime's default: zero instances on Cloud Run, two pods in a Prod-class environment on GKE and
  one elsewhere. On GKE each revision now scales on a HorizontalPodAutoscaler instead of one fixed
  replica, gets a PodDisruptionBudget from two pods up, and is reached in the cluster through a
  stable Service named after the application. Secrets on GKE now arrive as environment variables
  by default, synced into a Kubernetes Secret by the Secret Manager add-on, so the value also lives
  in the cluster; `secretsAs: files` keeps the mount. Clusters need `--enable-secret-sync` for
  this, and clusters Pipelines creates turn it on. A plain variable can name another
  application's address as `${{ apps.<key>.url }}` or `${{ apps.<key>.publicUrl }}`, filled in per
  environment at deploy time; a deploy naming one not yet deployed there stops and says so. The
  environment dialog says what each runtime costs and who follows its default. The export writes
  the same objects to Helm and Terraform.

  Adds `GET /api/v1/pipelines/applications/:key/settings`, `PUT` and `DELETE
/applications/:key/settings/:environment`, and `GET /environments/:key/runtimes`. Schema
  changeset `0028-pipelines-deploy-settings` adds the `pipeline_deploy_settings` and
  `pipeline_service_addresses` tables; it is quick and reversible.

- f3fda87: Everything Pipelines made on Google Cloud exports as Terraform and Helm you can run without it.
  Platform › Export shows one directory per connection, with its files, the values to fill in
  before a plan and what was left out, and downloads the whole bundle or one connection as a zip.
  An application's page gains Export, for its services alone. The Terraform declares the landing
  zone's projects, APIs, networks, log retention, budgets, identities and grants, the shared
  registry, secrets (never their values), each Cloud Run service at its serving release, the
  GKE clusters Pipelines created, each environment's front door and the Autopilot runner pools'
  clusters and bindings, with an import block per resource so a plan adopts what runs
  instead of creating it again. One Helm chart per catalog group renders what Pipelines deploys
  to GKE, with a values file per application per environment, and a runner-pools chart holds
  each Autopilot pool's namespace and service account. Revision history and the weights of a
  canary or a move in flight are left out, and each export says so.

  Adds `GET /api/v1/pipelines/exports` and `GET /exports/archive`, both for platform admins.
  No schema change.

- 2a526c9: Pipelines can put a front door in front of an environment: one Google Cloud load balancer with
  a stable address, a host for each application released there, and a Google-managed
  certificate when you name a domain. Turn it on in Platform › Environments; new Prod
  environments start with one. Where a front door serves an application, switching its runtime
  plans a move instead of waiting for the next deploy. The move's screen shows the steps, the
  downtime (none), a dated estimate of the month's cost and what is untested, then deploys on the
  new runtime, shifts traffic 10, 50 and 100 percent with the canary judge between steps, and
  removes the old runtime after a hold. Pause, Continue and Roll back work at any step. Canaries
  on GKE behind a front door move its weights too.

  Adds `GET /api/v1/pipelines/front-doors`, `PUT /environments/:key/front-door`,
  `GET /runtime-moves`, `GET /runtime-moves/:id` and `POST /runtime-moves/:id/start`, `/pause`,
  `/continue` and `/rollback`. Schema changeset `0025-pipelines-front-doors` adds three tables;
  it is quick and reversible. The front door has run only against recorded answers and the
  simulator, not a real Google Cloud project.

- 46a8c17: Pipelines can run applications on GKE beside Cloud Run. Each environment can have one cluster:
  created by Pipelines through a managed connection (Autopilot or Standard, the Regular release
  channel, a weekend maintenance window, Workload Identity, the Gateway API and the Secret
  Manager add-on on), or attached
  through an attached connection and only ever deployed into. Attaching checks the cluster and
  says in one sentence what to turn on or grant. Each application chooses its runtime per
  environment on its page, without a commit; `runtimes` in `.bemmoly/application.yaml` and an
  environment default are the fallbacks, and Cloud Run stays the default. On GKE a deploy writes a
  Deployment and a Service per revision into the catalog group's namespace, the canary split is
  the weights on one HTTPRoute per application, roll back moves every request back at once, and
  canaries are judged on the Gateway load balancer's numbers in Cloud Monitoring. Plain variables
  are environment variables in the pods; secrets are mounted at their recorded versions by GKE's
  Secret Manager add-on, as files under `/var/run/secrets/bemmoly/<NAME>` with `<NAME>_FILE`
  naming each, and the pods' Workload Identity principal is granted read access to each one.

  Adds `GET` and `POST /api/v1/pipelines/clusters`, `POST /clusters/:id/check`,
  `DELETE /clusters/:id`, `GET /applications/:key/runtimes` and
  `PUT /applications/:key/runtimes/:environment`, and `defaultRuntime` on environments. Schema
  changeset `0022-pipelines-gke-runtimes` adds the `cloud_clusters` and
  `pipeline_application_runtimes` tables and a column each to `pipeline_environments` and
  `pipeline_applications`; it is quick and reversible.

- 2f75fa9: Pipelines can create your Google Cloud projects from a single folder grant. Run
  `deploy/gcp/bootstrap.sh` once: it makes the Bemmoly folder, grants Project Creator and Folder
  Creator there and Billing Account User on one billing account, and prints the values to paste
  into Connect › Create projects for me. The connection check tests exactly those permissions and
  says for each one missing which role to grant and where. Choose Starter (a platform project,
  one for non-production and one for production), Standard (a project per environment) or
  Enterprise (per domain and environment). The plan shows every project, the shared registry and
  the identities, and how many projects the billing account pays for against what it adds. A
  billing account that is full stops the apply with how to ask Google for more, and Retry
  resumes without creating anything twice. Choosing another layout later adds projects and moves
  environments; it never deletes a project. A landing zone no longer takes over environments that
  deploy into attached projects, and each project's deployer now holds Cloud Run Admin there so
  public services deploy.

  A managed connection now names its folder (`folderId`) and control project (`controlProject`);
  connections that named only an organization keep working. Adds the `starter` layout and
  `GET /api/v1/pipelines/clouds/:id/plans/:planId`. Schema changeset
  `0024-pipelines-managed-layouts` adds the Starter layout, a `problems` column on
  `cloud_connections`, `warnings` and `billing` on `cloud_landing_zone_plans`, and drops the
  resource kind check on `cloud_resources`; it is quick and reversible.

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

- 3bab756: Applications have variables and secrets, for every environment or one, on a new Variables tab.
  A plain variable is stored and shown; a secret's value goes straight to Secret Manager in the
  environment's own project and is never shown again. Pipelines keeps only where it lives and its
  version. Deploys mount plain values and secrets, pinned to their versions, into the Cloud Run
  revision, grant whoever the service runs as read access to each secret, and record the set they
  used, so a roll back that redeploys gets the same values. CI jobs read the secrets their steps
  name from the store once, before the first step, and a fork still gets none. Changing a
  protected environment's variables needs a Release manager or Platform admin. An attached
  connection chooses the project that holds CI secrets in Platform › Clouds.

  Adds `GET /api/v1/pipelines/applications/:key/variables`, and `PUT` and `DELETE
/applications/:key/variables/:name`, with `?environment=` for one environment. `PATCH
/clouds/:id` takes `ciAccountId`. Schema changeset `0021-pipelines-secrets` adds `kind`,
  `secret_account_id` and `problem` to `pipeline_variables` and `variables` to
  `pipeline_deployments`; it is quick and reversible. It marks every value already stored as a
  secret waiting to move: the `pipelines.variables-move` job writes each to Secret Manager and
  clears it from the database every ten minutes, and the Variables tab says what any value still
  waits for. Enable the Secret Manager API in each project Pipelines deploys to.

### Patch Changes

- c3649f5: Pipelines no longer offers "This machine", the provider that deploys to the server's own
  Docker, unless an admin turns on the new workspace setting `pipelines.providers.local` (off
  by default). Admins: an install that used "This machine" must turn the setting on before its
  local environments deploy again; `demo:local setup` turns it on for the laptop demo and
  `demo:local undo` turns it off.

  The local traffic splitter's admin port now always needs its token: one started without a
  token refuses every admin request, and a splitter made before tokens existed is replaced,
  keeping its routes. `seed:demo -- --reset` now refuses a database that is not on this machine
  unless you add `--force`.

  In the Pipelines app, Enter on a focused button presses that button instead of opening the
  selected journey on For you; the "Remind approvers" button, which only opened the promotion,
  is gone; and every segmented control has a name for screen readers. The try-it walkthrough
  now says how to turn the simulator on and where each step is checked.

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
  - @bemmoly/api-client@2.0.0
  - @bemmoly/core-web@2.0.0
  - @bemmoly/shared@2.0.0
  - @bemmoly/ui@2.0.0

## 1.6.1

### Patch Changes

- @bemmoly/module-pipelines@1.6.1
  - @bemmoly/api-client@1.6.1
  - @bemmoly/core-web@1.6.1
  - @bemmoly/shared@1.6.1
  - @bemmoly/ui@1.6.1

## 1.6.0

### Patch Changes

- Updated dependencies [d793d2c]
  - @bemmoly/shared@1.6.0
  - @bemmoly/module-pipelines@1.6.0
  - @bemmoly/api-client@1.6.0
  - @bemmoly/core-web@1.6.0
  - @bemmoly/ui@1.6.0

## 1.5.0

### Patch Changes

- Updated dependencies [05e2355]
  - @bemmoly/ui@1.5.0
  - @bemmoly/core-web@1.5.0
  - @bemmoly/module-pipelines@1.5.0
  - @bemmoly/api-client@1.5.0
  - @bemmoly/shared@1.5.0

## 1.4.0

### Patch Changes

- Updated dependencies [cfe109d]
- Updated dependencies [7e9b170]
- Updated dependencies [b72b9e0]
- Updated dependencies [50337e9]
  - @bemmoly/shared@1.4.0
  - @bemmoly/ui@1.4.0
  - @bemmoly/module-pipelines@1.4.0
  - @bemmoly/api-client@1.4.0
  - @bemmoly/core-web@1.4.0

## 1.3.0

### Patch Changes

- d6208c1: Pipelines finds your repositories by itself once GitHub is connected. The second setup step
  shows how far the scan got, then the applications it found, or what it looked through with
  Scan again when it found nothing. Before, repositories that already existed when GitHub was
  connected were never scanned, and the step had nothing to press.
- Updated dependencies [5dae368]
- Updated dependencies [4fae3da]
- Updated dependencies [d6208c1]
  - @bemmoly/shared@1.3.0
  - @bemmoly/ui@1.3.0
  - @bemmoly/module-pipelines@1.3.0
  - @bemmoly/api-client@1.3.0
  - @bemmoly/core-web@1.3.0

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
- Updated dependencies [bee8b7b]
- Updated dependencies [f471fce]
  - @bemmoly/shared@1.2.0
  - @bemmoly/api-client@1.2.0
  - @bemmoly/ui@1.2.0
  - @bemmoly/module-pipelines@1.2.0
  - @bemmoly/core-web@1.2.0
