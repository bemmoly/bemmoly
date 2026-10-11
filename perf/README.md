# Load and soak tests

The performance budgets of the tech design (§20), measured with k6 against a real install,
plus the import exit criterion of §24 and a soak harness. CI runs them nightly and weekly
(`.github/workflows/nightly.yml`, `soak.yml`). Everything here also runs against any install
you can reach over HTTP and open a `psql` on.

| Budget (§20, p95 on the 2 vCPU reference VM) | Target   | Script                                    |
| -------------------------------------------- | -------- | ----------------------------------------- |
| Board view API, 500 issues                   | < 80 ms  | `k6/board.js`                             |
| Issue detail API                             | < 40 ms  | `k6/issue.js`                             |
| Search autocomplete (⌘K, each keystroke)     | < 100 ms | `k6/search.js`                            |
| Page open (collab connect + snapshot)        | < 150 ms | `k6/docs-page.js`                         |
| Memory, steady, 200 users                    | < 512 MB | `k6/soak.js` with `src/soak/monitor.ts`   |
| A 10,000-issue Jira site imports (§24)       | < 30 min | `src/jira/serve.ts`, `src/jira/import.ts` |

Also measured: two people typing into one page over `/collab` (`k6/collab.js`, every keystroke
must reach the other person) and a mixed realistic workload (`k6/mixed.js`: 200 people's day,
reads and writes, page opens and pairs typing, every budget at once). Endpoints §20 does not
name are held to the budget of their class; `k6/lib/budgets.js` says which.

## What it creates, and how it cleans up

Everything carries `LOAD`: people `LOAD Admin` and `LOAD User 001…` with addresses
`load-…@load.bemmoly.test` (a reserved, unroutable domain), projects `LOADA`, `LOADB`,
`LOADC` (and `LOADJ` from the import), spaces `LOADD` and `LOADE`. Teardown removes exactly
those projects and spaces and deactivates exactly those people; nothing else is touched.

- **People** are created server side by SQL (`sql/provision.sql`), because the API mints
  tokens only from a signed-in session and `/collab` accepts only a session cookie. Each
  person gets a personal API token and a session; only their sha256 reaches the database.
  The secrets stay in the credentials file, mode 0600. Keep it outside the repository.
- **200 people**, because each person may make 600 API requests a minute; the scripts deal
  requests out across people per iteration so the load, not the rate limit, is measured.
- **Notifications**: writes notify watchers and assignees, which queues emails to the
  load-test addresses. They go nowhere without SMTP and fail harmlessly with it.
- **AI**: if the install has an embedding model role, the seeded issues and pages are
  indexed for AI search, which calls the provider (and costs money). Check
  Settings › AI first, or seed a smaller dataset.

## Run it against an install

Node 24 and `pnpm install` in a checkout, Docker for k6 (`run-k6.sh` uses the pinned
`grafana/k6` image), and `psql` access to the install's database. On a Compose install that is
`sudo bemmoly shell db`, which reads SQL from standard input.

```sh
# 1. People: one org admin, 200 members, tokens and sessions
node perf/src/provision.ts --users 200 --out ~/load/credentials.json | ssh host sudo bemmoly shell db

# 2. The sample dataset: 3 projects (LOADA is the 500-issue board), 5,000 issues, 400 pages
node perf/src/seed.ts --base-url https://bemmoly.example.com \
  --credentials ~/load/credentials.json --out ~/load/dataset.json

# 3. The budget suite: board, issue, search, docs-page, collab, mixed
export BASE_URL=https://bemmoly.example.com CREDENTIALS=~/load/credentials.json \
  DATASET=~/load/dataset.json OUT_DIR=~/load/results
bash perf/run-suite.sh                 # or name scripts: bash perf/run-suite.sh board issue
cat ~/load/results/report.md           # the results table; exit status 1 if a budget failed
```

Each script takes knobs from the environment: `RATE` (iterations a second in the measured
phase), `DURATION` (default `2m`), `WARMUP` (default `20s`, not measured). `collab.js` takes
`PAIRS`, `SESSION_SECONDS` and `KEY_MS`; `mixed.js` and `soak.js` take `RATE`, `PAGE_RATE`
and `PAIRS`. One script alone: `bash perf/run-k6.sh board.js`.

**Where the time goes.** k6 times the whole trip. Every budget script also measures
`network_floor` (`GET /healthz`, which does no work), so a slow path to the server (a proxy,
a VM port forward) shows up as a high floor rather than a slow endpoint. With `METRICS_CMD`
set to a command that prints the install's `/metrics` (it needs `BEMMOLY_METRICS_TOKEN`), the
suite also writes the server's own p50/p95/p99 per route for each script
(`<script>.server.md`, from `src/server-latency.ts`):

```sh
export METRICS_CMD='ssh host "sudo sh -c '\''curl -s -H \"Authorization: Bearer \$(grep ^BEMMOLY_METRICS_TOKEN= /var/bemmoly/.env | cut -d= -f2-)\" http://127.0.0.1:8080/metrics'\''"'
```

Run from a machine near the install, not over a VPN or a laptop's port forward, and keep
other heavy work off both while measuring.

## The 10,000-issue Jira import

The importers' own fake Jira Cloud site (`apps/server/src/imports/fake-atlassian.ts` and
`generate.ts`: two comments, labels, a sprint, story points, an epic parent and a link per
issue) is served behind a proxy that answers on every address and renames the project to
`LOADJ` and its forty people into the load-test domain, so nothing an import makes falls
outside the cleanup.

```sh
node perf/src/jira/serve.ts --issues 10000 --port 8765          # on a machine the install can reach
node perf/src/jira/import.ts --base-url https://bemmoly.example.com \
  --credentials ~/load/credentials.json --site http://<that machine>:8765 --out import.json
```

`import.ts` connects through Settings › Import's API as the load admin, picks `LOADJ`, starts
the run and polls it; the clock runs from "run" until the job settles, as the importer's
performance test measures it, and the result says whether it beat 30 minutes. A Jira Cloud
site on a private address is refused unless the install sets `BEMMOLY_ALLOW_PRIVATE_URLS=true`;
set it for the run (`sudo bemmoly config set BEMMOLY_ALLOW_PRIVATE_URLS true`, which restarts
the app) and back to empty afterwards.

## The soak

`k6/soak.js` holds the mixed workload (default 30 actions a second, a page open every two
seconds, two pairs typing) for `DURATION` (default 24h). Alongside, `src/soak/monitor.ts`
samples the server every `--interval` seconds and writes one JSON line per sample: RSS, heap,
event-loop lag, the database pool, open Postgres connections (`--db-cmd`), job queue depth
per queue, WebSockets, and for the window since the last sample the API requests, 4xx, 5xx,
429s and p50/p95/p99 from the latency histogram. On Ctrl-C or at `--duration` it writes a
summary: first and last tenth, peak and growth per hour for memory and heap, p95 drift, peak
connections and queue depth, the error rate, and verdicts (Node under 512 MB, heap not
climbing faster than 20 MB/h, p95 drift under 25%, 5xx under 1%, queues drained).

```sh
node perf/src/soak/monitor.ts --interval 15 --metrics-cmd "$METRICS_CMD" \
  --db-cmd 'ssh host sudo docker exec bemmoly-db-1 psql -U bemmoly -d bemmoly_db -tAc "select count(*) from pg_stat_activity"' \
  --out soak.jsonl --summary soak-summary.json &
DURATION=45m bash perf/run-k6.sh soak.js
kill -INT %1
```

## Clean up

```sh
node perf/src/teardown.ts --base-url https://bemmoly.example.com --credentials ~/load/credentials.json
ssh host sudo bemmoly shell db < perf/sql/teardown.sql   # revoke tokens, end sessions, deactivate
```

The deactivated people stay, so the audit trail keeps their names; import history rows in
Settings › Import stay too.

## In CI

The nightly **Load budgets (k6)** job builds a stand-in for the reference VM on a hosted
runner (`.github/actions/load-install`): Postgres and the server from `main` pinned to CPUs 0-1,
k6 pinned to CPUs 2-3, setup finished through the API, then the steps above with
`K6_NETWORK=host`. The weekly **Soak** runs 24 hours on a self-hosted runner named by the
repository variable `SOAK_RUNNER` (a hosted runner stops at 6 hours, so it runs 5 there).
Both put the results table in the job summary and open an issue on a regression.
