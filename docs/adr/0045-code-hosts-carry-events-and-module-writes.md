# ADR 0045: Code hosts carry events and the writes modules need

- Status: accepted
- Date: 2026-10-17
- Changes: the kernel code-host contract (`contracts/code-hosts.ts`, `modules/code.ts`),
  which carried only link activities (pull requests, branches, commits) to consumers that
  write issue links
- Design: [Pipelines architecture §8](../proposals/pipelines/architecture.html) (GitHub at
  scale)

## Context

Work turns code host deliveries into links, and the contract was shaped for that: an
activity names a pull request, a branch or a commit, and its `mode` says link, update or
remove. Pipelines needs more from the same deliveries and the same connected hosts: what a
push changed (to start the right runs and sync `.bemmoly/application.yaml`), a pull
request's head commit and base, merge queue groups, check and workflow runs (external CI
results as gates), and repository changes (to re-run discovery). It also writes: check runs
per job state, deployments and their statuses, file reads and trees for discovery, and bot
pull requests. A module may not import a forge client (AGENTS.md, architecture §8), so all
of it has to come through the kernel.

Adding new activity kinds would have reached Work's consumer, which links every activity it
is not told to update or remove.

## Decision

1. **Events beside activities.** A driver's `parse` may return `events`: host-neutral
   `CodeEvent`s (`push`, `pull_request`, `merge_group`, `check_run`, `workflow_run`,
   `repository`). Modules register `ctx.code.addEventConsumer`; the kernel stamps each event
   with its integration and delivery id and calls the enabled modules' event consumers after
   the link consumers, in the same claimed-once delivery. Events never create links.
2. **Push detail on activities too.** A push's branch activity carries `push`
   (`CodePush`: before, after, default branch, changed files, whether the list was cut short),
   for consumers of links that want it.
3. **Writes through a directory.** `ctx.code.hosts().clientFor(repository)` returns a
   `CodeHostClient` for the connected host that covers the repository (one that lists it,
   else a GitHub App installation) with `reportCheck`, `reportDeployment`, `readFile`,
   `listFiles` and `openPullRequest`. Drivers implement them as optional `CodeHostApi`
   methods; a host without one throws a ProviderError that says so. GitHub implements all
   of them over the Checks, Deployments, Contents, Git and Pulls APIs, with the shared REST
   client's timeouts and rate-limit backoff. Credentials are opened per client and a client
   is reused for at most 30 minutes, so an installation token is not fetched per call.
4. **Permissions on request.** Modules call `ctx.code.requestAppPermissions` with the
   GitHub App permissions and events they need; the manifest the kernel offers merges the
   enabled modules' requests (write wins over read). Without Pipelines the app stays
   read-only, as before.
5. **Vendor shapes stay in the driver.** Payload and API shapes live in `hosts/github-*.ts`
   and are tested against hand-written and recorded fixtures under `testing/code-hosts`.

## Consequences

- Work is unchanged: it never sees events, and its activities only gain an optional field.
- A consumer runs inside the webhook request, so an event consumer must store and return
  (Pipelines writes its durable inbox and processes it in order per repository later).
- GitLab parses no events and has none of the writes yet; its clients say so when asked.
- An app created before Pipelines was enabled keeps its old permissions until an admin
  accepts the new ones in GitHub; the Pipelines setup tells them to.
