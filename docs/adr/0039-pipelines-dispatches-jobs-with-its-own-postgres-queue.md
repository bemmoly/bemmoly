# ADR 0039: Pipelines dispatches jobs with its own Postgres queue

- Status: accepted
- Date: 2026-10-17
- Builds on: [ADR 0037](0037-pipelines-is-a-separate-product-with-its-own-shell.md) (Pipelines as
  a product on the kernel); the architecture proposal, §5 and §6
  (`docs/proposals/pipelines/architecture.html`)

## Context

Runners long-poll the control plane for jobs. At the size Pipelines is designed for (1,000
applications, 75,000 jobs a day, 400 concurrent) the claim is the hot path, and it needs rules
a general queue does not have: fair share between teams, priority classes, concurrency groups,
superseding, and recovery when a runner disappears. pg-boss, which the kernel uses for
background work, has none of these, and its polling added seconds of delay in earlier load
tests. The repository rule is Postgres only: no Redis, no broker.

## Decision

1. **Jobs are their own queue.** `pipeline_jobs` holds every job with its state, pool, team,
   priority class (a generated `priority` column) and concurrency key. Partial indexes cover
   only live states, so a claim stays an index read however much history accumulates. pg-boss
   stays for Pipelines' background work (releases from builds, check runs, schedules, sweeps).
2. **One claim is one transaction.** It locks the pool's row (claims for one pool take turns),
   finds the teams with eligible ready work in the most urgent class present, picks the team,
   and claims that team's oldest eligible job with `FOR UPDATE SKIP LOCKED`. Locking the pool
   row keeps the fair-share state exact without a separate coordinator; SKIP LOCKED keeps a
   claim from waiting on rows another writer (a cancel, a sweep) holds.
3. **Classes are strict; fair share works inside a class.** rollback > deploy > main >
   pull_request > scheduled. Roll backs and deploys skip fair share and go oldest first. The
   others are shared between teams by **weighted deficit round robin**, one step per claim, with
   its state (whose turn, each team's credit) stored as JSON on the pool row. A team with
   nothing waiting loses its credit, so idle share is borrowed by whoever has work and handed
   back at the next claim, never by stopping a running job. Weights come from
   `pipeline_team_shares` (default 1).
4. **Concurrency keys** hold at most `concurrency_limit` claimed or running jobs per key (1 for
   deploys). **Superseding** (a newer commit on the same pull request or branch) cancels the
   older run's waiting and running jobs, except deploys already running.
5. **Wake-ups, not polling.** Making a job ready sends `NOTIFY pipelines_dispatch, <pool id>`
   in the same transaction; a long-polling claim waits on one LISTEN connection per process and
   retries at once. Waits also end on a timeout, so a lost notification costs seconds at most.
6. **Lost runners and timeouts.** Runners heartbeat every 10 s. A sweep (on claims and
   heartbeats, at most every 10 s per process, and a minute job) returns jobs whose runner
   missed three beats to ready with attempt + 1, at most twice, then fails them with the reason;
   jobs past their timeout fail and their runner hears "cancel" at its next heartbeat. Only jobs
   handed out through the protocol (they hold a job token) are swept.
7. **Tokens are hashed.** Pool, runner and job tokens are 32 random bytes behind a recognisable
   prefix (`bpp_`, `bpr_`, `bpj_`), stored as SHA-256. Job tokens name one job and expire with
   its timeout plus a grace period for late log chunks.

## Measurements

`pnpm --filter @bemmoly/module-pipelines bench:dispatch` on a laptop Postgres 18 (Colima,
3,000 ready jobs, 8 teams, no other load):

| Workers claiming at once | Claims a second | p50 | p99 |
| --- | --- | --- | --- |
| 1 | 212 | 4.4 ms | 11.8 ms |
| 4 | 234 | 16.6 ms | 38.0 ms |
| 16 | 226 | 66.0 ms | 125.7 ms |

The target in §5.3 is 50 claims a second with a p99 under 50 ms. One pool serialises at about
220 claims a second; latency above that is time spent waiting for the pool's turn, which only
a burst of more than 200 simultaneous claims on one pool produces. Pools are independent, so
throughput grows with pools. The integration suite claims 200 jobs from 10 workers and checks
none is claimed twice.

## Consequences

- Fairness, classes and recovery are unit-tested as pure functions (property tests for the
  round robin) and against a real Postgres.
- A very large single pool may later want the team choice made per batch of claims instead of
  per claim; the stored state already allows it.
- Partitioning `pipeline_jobs` by month is a later changeset; the partial indexes make the claim
  independent of history until then.
