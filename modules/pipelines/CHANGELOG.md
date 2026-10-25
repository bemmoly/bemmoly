# @bemmoly/module-pipelines

## 1.6.0

### Patch Changes

- Updated dependencies [229ccb1]
- Updated dependencies [d793d2c]
  - @bemmoly/core@1.6.0
  - @bemmoly/shared@1.6.0

## 1.5.0

### Patch Changes

- @bemmoly/core@1.5.0
  - @bemmoly/shared@1.5.0

## 1.4.0

### Patch Changes

- Updated dependencies [cfe109d]
- Updated dependencies [50337e9]
  - @bemmoly/core@1.4.0
  - @bemmoly/shared@1.4.0

## 1.3.0

### Patch Changes

- d6208c1: Pipelines finds your repositories by itself once GitHub is connected. The second setup step
  shows how far the scan got, then the applications it found, or what it looked through with
  Scan again when it found nothing. Before, repositories that already existed when GitHub was
  connected were never scanned, and the step had nothing to press.
- Updated dependencies [5dae368]
- Updated dependencies [4fae3da]
- Updated dependencies [d6208c1]
  - @bemmoly/core@1.3.0
  - @bemmoly/shared@1.3.0

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
- Updated dependencies [0435d23]
  - @bemmoly/core@1.2.0
  - @bemmoly/shared@1.2.0
