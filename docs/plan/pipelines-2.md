# Bemmoly Pipelines 2.0: the build plan

This plan turns [the journeys proposal](../proposals/pipelines/journeys.html) into work. The
proposal says what Pipelines is for and what a company chooses when it adopts it. This file says
what gets built, in what order, and how each step is proven.

## Where it starts

An audit of `main` at 1.6.1 (29 October 2026) found every automated check green, and found
three gaps that matter more than any bug:

- **Shipping runs only on demo data.** The server never writes an environment, a promotion
  path, a variable, a template or a freeze. Only the seed does. A fresh install cannot promote
  anything.
- **No real cloud has been called.** Google Cloud is tested only against hand-written
  responses, images built by Pipelines' runners are never pushed to a registry, and there is
  no way to attach a project a company already has.
- **Nothing is installable outside the repository.** The runner, the `bp` CLI and the GitHub
  Action run only from source.

## Rules for this plan

- **Every milestone ends in something a person can test on their own project.** A milestone is
  not done until its journey has run against a real account, recorded in its pull request.
- **One pull request per milestone**, opened as a draft, merged only after it has been tested
  by hand. Safety fixes that stand alone go in their own small pull requests.
- **Fakes stay honest.** The in-memory provider and the recorded responses keep the
  integration tests fast, but a feature that has only met a fake is reported as untested.
- **The version.** 2.0.0 is cut when milestones 1 to 6 are merged. All packages share one
  version, so one major changeset moves them together.

## Milestones

### 1. Ship to a Google Cloud project you already have

The smallest journey that touches a real cloud. It builds on attached mode from the proposal,
because a company's own project is what most people will test with first.

- A Google Cloud connection can be **managed** (today's folder, organization and billing) or
  **attached** (projects that already exist, nothing created).
- Attach a project: Pipelines checks it can see the project, that the Cloud Run and Artifact
  Registry APIs are on, and that it holds the permissions a deploy needs. Each problem is one
  sentence saying what to grant.
- Sign-in from a laptop through the person's own gcloud application default credentials, beside
  the VM service account and workload identity federation. Key files stay refused.
- **Environments you can create**, edit and archive, each pointing at an attached project and a
  region, and **promotion paths you can set** per tier.
- **Image push.** When a registry is set, the runner's build step pushes the image and reports
  its registry digest, and the release records that repository. Cloud Run deploys it by digest.
- The application's deploy settings (port, CPU, memory) reach the Cloud Run revision.
- Screens: attach a project in Platform › Clouds; create environments and set paths in
  Platform › Environments; the registry in Platform › Clouds.

**Done when** a repository with a Dockerfile goes from a push to a running Cloud Run service
in Dev, is promoted to Prod with an approval, and is rolled back, on a real project.

### 2. Safety defaults

From the audit, each fix small and separate:

- The local Docker provider registered only when an operator turns it on.
- The traffic splitter's admin API refused without its token.
- `seed:demo --reset` refused against anything but a local database unless forced.
- The setup guide says what the simulator switch really does.
- No public source maps for the Pipelines web app.
- For you's Enter key leaves focused buttons alone; "Remind approvers" is removed until it
  reminds anyone; the trains client stops calling a route that does not exist.

### 3. Secrets and variables

- Application variables and secrets you can set per environment, in the API and on screen.
- Secret values written straight to Secret Manager in the environment's project and mounted
  into the Cloud Run revision. Pipelines stores references and versions, never values.
- The plain-text secrets table emptied by a changeset that moves existing values out.

**Done when** a deployed service reads a secret set from the screen, and the database holds no
secret value.

### 4. Managed mode on a real account

- The folder grant from the proposal: Project Creator and Folder Creator on one Bemmoly folder,
  Billing Account User on one billing account.
- The Starter, Standard and Enterprise layouts, creating projects, the shared registry and the
  identities, with the billing-account project limit checked before anything starts.
- `deploy/gcp/bootstrap.sh` run once against a sandbox organization, and the recorded
  responses in the tests replaced by ones captured from it.

**Done when** an empty Google Cloud organization reaches a Prod deploy in under 45 minutes.

### 5. GKE as a runtime

- A runtime per application per environment: Cloud Run, GKE Autopilot, GKE Standard or an
  attached cluster.
- Deploys into a namespace per group, with rollouts through the Gateway API's weights.
- In managed mode: cluster creation in the Regular release channel, maintenance windows, and
  node pools on Standard. Attached clusters are only ever deployed into.

**Done when** one application runs on Cloud Run and another on GKE Autopilot in the same
environments, and both canary and roll back.

### 6. Build machines and the front door

- Runner pools that start themselves on GKE Autopilot in the CI project and scale to zero.
- Cloud Build running the runner image for one job, for the first day with no cluster.
- A front door per service, so a switch between Cloud Run and GKE is a weighted traffic move
  with a plan screen showing cost and downtime first.
- Export of everything Pipelines created as Terraform and Helm.

**Done when** a service moves from Cloud Run to GKE and back with no failed requests.

### After 2.0

The AWS provider (ECS Express Mode, EKS Auto Mode, Lambda), Argo CD and Flux as deploy-only
targets, publishing the runner image, the CLI and the GitHub Action, and the proposal's
features that were never started: preview environments, chat approvals and MCP tools.

## How each milestone is tested

1. Unit and integration tests as `AGENTS.md` requires, against the fake provider and recorded
   responses.
2. The Pipelines walkthrough (`pnpm --filter @bemmoly/e2e test:e2e:pipelines`) stays green, and
   gains a spec for each new screen.
3. The milestone's journey run by hand on a real account, with what happened written in the
   pull request. Anything not run there is listed as untested.
