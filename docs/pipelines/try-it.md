# Try Bemmoly Pipelines

A walkthrough of Pipelines on your laptop, in about 30 minutes: the seeded Acme organisation,
a real pipeline run on a local runner, a promotion through Dev, Staging and Prod with canaries
on your own Docker, a release registered from another CI, access, and clouds. Every step says
the exact command and what you should see. Steps 1, 2, 4 and 5 also run as Playwright specs in
`apps/e2e/pipelines` (`pnpm --filter @bemmoly/e2e test:e2e:pipelines`, whose setup does step
0); steps 3 and 6 have no spec yet and are checked by hand.

You need Node 24, pnpm, and Docker (Colima is fine) running.

<!-- STATUS (2026-10-17): steps 0, 2 and 4 were verified by the Playwright walkthrough. Steps 1, 3, 5 and 6 were verified by the streams that built them, by hand on their own installs, but not yet by the final walkthrough on the branch tip. -->

## 0. Start Bemmoly with Pipelines

```sh
pnpm install
pnpm build                       # once: the server serves the built web apps in e2e; dev uses Vite
pnpm dev                         # Postgres in Docker, the server on :8080, Bemmoly on :5173
```

Open http://localhost:5173 and finish the setup wizard if this database is new (you become the
first admin; For you is yours). Then, in a second terminal:

```sh
pnpm --filter @bemmoly/module-pipelines seed:demo            # first time
pnpm --filter @bemmoly/module-pipelines seed:demo -- --reset # to start over
```

`seed:demo` enables Pipelines for everyone and seeds Acme: 512 people, 54 teams, 1,140
applications in 9 domains, 30 days of runs, releases and deploys, and the live picture right
now. It takes about a minute. `-- --scale 0.2` seeds a fifth of it. `--reset` empties every
Pipelines and cloud table first, so it refuses a database that is not on this machine
(localhost or a unix socket) unless you add `--force`.

Open **http://localhost:5173/pipelines/**.

### Turn the simulator on (for `demo:live` and step 6)

`pipelines.providers.simulate` is a workspace setting, off by default, and nothing in this
walkthrough turns it on for you. While it is on, the Google Cloud provider is an in-memory fake:
deploys and landing zones are simulated and nothing reaches a real cloud. As the first admin,
create an access token that can write in **Settings › Access tokens**
(http://localhost:5173/settings/access-tokens), then:

```sh
curl -X PUT http://localhost:8080/api/v1/admin/settings/pipelines.providers.simulate \
  -H "Authorization: Bearer <token>" -H 'Content-Type: application/json' -d '{"value":true}'
```

`-d '{"value":false}'` (or `curl -X DELETE` on the same address) turns it off again.

## 1. Look around: For you, Map, Catalog, an application, Runs

- **For you** (`/pipelines/`): your changes as journeys from commit to every Prod region, what
  waits for your approval, your teams' main branches, who is on call. `J`/`K` move, `Enter`
  opens, `A` approves, `Shift+R` re-runs a failure.
- **Map**: every domain against every stage, live. `Enter` opens a domain in place, `Backspace`
  zooms out, `[` and `]` step back and forward in time, `L` returns to live, or drag the
  timeline at the foot to rewind to any moment in the last 30 days.
- **Catalog**: all 1,140 applications with facets and saved views. `/` filters, `F` focuses the
  facets, `S` saves the view.
- **An application**: the environment strip, what differs from the stage before it, Prod health,
  runs. `R` runs, `P` promotes, `Shift+B` rolls back.
- **Runs** and a run: the stage graph, the log that opens on the first error.
- Everywhere: `Mod+K` for the palette ("run checkout-api", "who owns search-api", "roll back …"),
  `?` for every key, `T` or the person menu for Light, Dark or Match system.

### Keep it moving (optional)

```sh
pnpm --filter @bemmoly/module-pipelines demo:live            # beside pnpm dev, after seed:demo
pnpm --filter @bemmoly/module-pipelines demo:live -- --rate 4 --quiet
```

Runs start, pass and sometimes fail (about 8%); passing main runs become releases that deploy
to Dev and Staging and ask for Prod; canaries step 5%, 25%, 100% and about one in ten rolls
back. Two actions a second by default (`--rate`, at most 10); the same `--seed` repeats the same
story. `Ctrl+C` stops it. Its deploys are simulated: turn `pipelines.providers.simulate` on
first (it is off by default; see "Turn the simulator on" above) and keep it on while it runs.

## 2. Run a pipeline on your laptop

```sh
pnpm --filter @bemmoly/module-pipelines demo:runner -- --url http://localhost:8080
```

It creates a `laptop` runner pool with a fresh token and gives `checkout-api` and
`payments-worker` a pipeline whose steps really run (build, unit tests in two shards, lint as a
matrix, a security scan). It prints the command that starts a runner; run it:

```sh
node apps/runner/src/main.ts --url http://localhost:8080 --pool-token <printed> --local \
  --data-dir /tmp/bemmoly-runner-laptop --allow-build-path <printed>
```

Leave out `--local` to run each step as a container in Docker instead.

Open **checkout-api** (Catalog, press `/`, type `checkout-api`, Enter) and choose **Run**,
then **Run pipeline** (`Mod+Enter`). You land on the run: Build prints "Compiling 214
modules" live, then the first Unit shard fails on its first attempt with "retries a timed-out
UPI collect" (the demo's `flaky` input). When the run has finished, **Re-run failed**
(`Shift+R`) runs only that shard and the scan after it; the same run then passes.

## 3. Promote Dev → Staging → Prod with canaries on your Docker

```sh
pnpm --filter @bemmoly/module-pipelines demo:local setup
```

`setup` turns on `pipelines.providers.local` (off on every install by default; it offers the
local Docker provider, "This machine"), points every environment at your Docker, shortens
rollout timings and lifts deploy windows (`undo` restores them and turns the setting off), ships
a good **pricing-svc** release through Dev and Staging as a member of its team, and asks for
Prod. Restart the server (`Ctrl+C`, `pnpm dev`) so it reads the shorter timings and the new
setting. Then:

1. Open **For you**: the Prod promotion waits for you under Waiting for you. Open it: what's
   changing, every gate with its reason, the approvers, the rollout plan. Approve (`A`), or run
   `demo:local approve` to approve as another engineer of the team.
2. Watch the application page: the canary moves 5%, 25%, 100% between two real containers.
   `demo:local status` prints a `curl` address per environment; curl it a few times and you get
   answers from both versions.
3. `demo:local bad`, then approve that one: the new version fails a third of its requests in
   Prod asia-south1. At 5% the canary measures it against stable (about 22% errors against 0%) and
   **rolls back by itself**; the deployment says why.
4. **Roll back** (`Shift+B` on the application) works any time, skipping gates and windows.

`demo:local continue` resumes a paused (marginal) canary; `demo:local undo` points the
environments back at Google Cloud (simulated while the simulator is on) and removes the
containers.

## 4. Bring your CI: register a release built elsewhere

Create a CI token scoped to `checkout-api` with `POST /api/v1/pipelines/ci/tokens`; there is
no screen for it yet. With the access token from "Turn the simulator on":

```sh
curl -X POST http://localhost:8080/api/v1/pipelines/ci/tokens \
  -H "Authorization: Bearer <access token>" -H 'Content-Type: application/json' \
  -d '{"name":"Laptop CI","applications":["checkout-api"]}'
```

It answers with the CI token (`"token"`). Then:

```sh
BEMMOLY_PIPELINES_URL=http://localhost:8080 BEMMOLY_PIPELINES_TOKEN=<token> \
  node apps/pipelines-cli/src/bin.ts release create --application checkout-api \
  --commit $(git rev-parse HEAD) --image sha256:<64 hex> --version 9.9.9
```

It prints `Registered checkout-api 9.9.9 …` and the release id; open
`/pipelines/releases/<id>/promote` to promote it. The same token is refused for any other
application.

## 5. Access: refused with a reason, and the checker

Open **Platform › Access**. Pick **Commerce** in the scope tree: the bindings there, with the
inherited ones marked, and the policies as sentences (switch to Code to see the CEL). In
**Check access**, choose a member of Checkout web, the action Request Prod deploy and
checkout-api: "Not allowed", the sentence ("… Tier 0 to Prod needs a Maintainer to request it.
Ask Payments for access.") and how it was decided, step by step. The same answer comes from the
terminal with `node apps/pipelines-cli/src/bin.ts why …`. Anything refused in the product shows
the same sentence and who to ask.

## 6. Platform › Clouds with the fake provider

Turn the simulator on first (see "Turn the simulator on"). Open **Platform › Clouds** and choose
**Connect a cloud**. Google Cloud is available and, with the simulator on, is the in-memory fake
provider: nothing reaches a real cloud. With the simulator off it is the real provider and
connecting it reaches your Google Cloud organisation. AWS, Azure and Kubernetes say Coming soon;
**This machine** (your Docker) is offered only while `pipelines.providers.local` is on, as it is
between `demo:local setup` and `demo:local undo`. Pick a layout (one project per environment,
per domain and environment, or per group and environment), read the preview tree of everything
that would be created, and create it: the checklist fills in as the landing zone is reconciled.
The real Google Cloud bootstrap is `deploy/gcp/bootstrap.sh` (`--dry-run` prints every command
without running it).

## Stopping

`Ctrl+C` in the `pnpm dev` terminal and the runner's. Containers the local provider started are
named `bp-<environment>-<application>-…`; `pnpm --filter @bemmoly/module-pipelines demo:local undo`
removes them.
