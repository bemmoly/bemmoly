# Try Bemmoly Pipelines

A walkthrough of Pipelines on your laptop, in about 30 minutes: the seeded Acme organisation,
a real pipeline run on a local runner, a promotion through Dev, Staging and Prod with canaries
on your own Docker, a release registered from another CI, access, and clouds. Every step says
the exact command and what you should see. The same journeys run as Playwright specs in
`apps/e2e/pipelines` (`pnpm --filter @bemmoly/e2e test:e2e:pipelines`).

You need Node 24, pnpm, and Docker (Colima is fine) running.

<!-- STATUS: steps 0, 2 and 4 were verified by the Playwright walkthrough on 2026-10-17; the sections marked TODO were not verified yet. -->

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
now. It takes about a minute. `-- --scale 0.2` seeds a fifth of it.

Open **http://localhost:5173/pipelines/**.

## 1. Look around: For you, Map, Catalog, an application, Runs

TODO: what each screen shows with the seed, keys to try (`⌘K`, `/`, `j`/`k`), rewind on the Map.

### Keep it moving (optional)

TODO: the demo simulator command, how fast things move, how to stop it.

## 2. Run a pipeline on your laptop

```sh
pnpm --filter @bemmoly/module-pipelines demo:runner -- --url http://localhost:8080
```

It creates a `laptop` runner pool with a fresh token and gives `checkout-api` and
`payments-worker` a pipeline whose steps really run (build, unit tests in two shards, lint as a
matrix, a security scan). It prints the command that starts a runner; run it:

```sh
node apps/runner/src/main.ts --url http://localhost:8080 --pool-token <printed> --local --data-dir /tmp/bemmoly-runner-laptop
```

Leave out `--local` to run each step as a container in Docker instead.

Open **checkout-api** (Catalog, press `/`, type `checkout-api`, Enter) and choose **Run**,
then **Run pipeline** (`Mod+Enter`). You land on the run: Build prints "Compiling 214
modules" live, then the first Unit shard fails on its first attempt with "retries a timed-out
UPI collect" (the demo's `flaky` input). When the run has finished, **Re-run failed**
(`Shift+R`) runs only that shard and the scan after it; the same run then passes.

## 3. Promote Dev → Staging → Prod with canaries on your Docker

TODO: the local provider, gates, approval by a second person, the canary splitting real
traffic between two containers (`curl` the splitter), Roll back.

## 4. Bring your CI: register a release built elsewhere

Create a CI token scoped to `checkout-api` (`POST /api/v1/pipelines/ci/tokens` with
`{"name":"Laptop CI","applications":["checkout-api"]}`, or Platform › Bring your CI where it
is drawn), then:

```sh
BEMMOLY_PIPELINES_URL=http://localhost:8080 BEMMOLY_PIPELINES_TOKEN=<token> \
  node apps/pipelines-cli/src/bin.ts release create --application checkout-api \
  --commit $(git rev-parse HEAD) --image sha256:<64 hex> --version 9.9.9
```

It prints `Registered checkout-api 9.9.9 …` and the release id; open
`/pipelines/releases/<id>/promote` to promote it. The same token is refused for any other
application.

## 5. Access: refused with a reason, and the checker

TODO

## 6. Platform › Clouds with the fake provider

TODO

## Stopping

`Ctrl+C` in the `pnpm dev` terminal and the runner's. Containers the local provider started are
named `bp-<environment>-<application>-…`; TODO: the command that removes them.
