# How big a server Bemmoly needs

Measured on Bemmoly 0.12.0, 2026-10-11 and 12, with the load and soak harness in `perf/`
(`perf/README.md`). Each size was one Bemmoly install from the one-command installer, its
Postgres retuned with the installer's own formula for the size, then loaded until it broke.
Everything here is on code from **before the query fixes (#156) and board paging (#159)**,
both of which target exactly the bottlenecks below; the sizes will be measured again after
them.

**Status:** 2 vCPU / 4 GB is measured in full. 2 vCPU / 2 GB is **partial**: its concurrency
ramp and three of its four data points are valid, the fourth is not. 4 vCPU / 8 GB is **not
measured**: its ramp ran while the laptop was busy and its data ramp was stopped, so its
numbers below are preliminary and not used for sizing.

## The answer

| Size | Load within every budget | People at once | Organisation | Data within budget, under load | Bottleneck |
| --- | ---: | ---: | ---: | --- | --- |
| 2 vCPU, 4 GB | 80 actions/s | 400 | 2,000 | 37,501 issues, 5,200 pages; issue and page open stay near budget to ~120,000 issues (issue p95 47 ms), ⌘K and Docs search pass 100 ms from ~70,000, everything is slow at ~270,000 | Postgres CPU |
| 2 vCPU, 2 GB (partial) | 80 actions/s | 400 | 2,000 | 78,299 issues, 10,000 pages | Postgres CPU |
| 4 vCPU, 8 GB (not measured) | 120 actions/s, preliminary | 600 | 3,000 | not measured | Postgres CPU and the 10-connection pool, preliminary |

- **Within budget** means every §20 budget held at the server's p95 (board view < 80 ms,
  issue < 40 ms, ⌘K and search < 100 ms, page detail and page open < 150 ms) with errors
  under 0.1%. Boards are the exception in the data column: a board whose sprint or column holds
  several thousand cards is over budget at every size until board paging (#159) lands, so the
  data column holds everything but those boards, and the board numbers are listed apart.
- **People** use the site's assumption: an active person makes about 0.2 requests a second
  (one action every 5 seconds, counting page loads and realtime refetches), and about 20% of
  an organisation is active at once. 80 actions a second is therefore about 400 people at
  once and an organisation of about 2,000. These are assumptions, not measurements.
- More memory alone does not move the concurrency limit: 2 GB and 4 GB both hold 80 actions
  a second, because both are bound by two CPUs of Postgres. Memory decides how much data stays
  fast; the 2 GB run held its data well here partly because its docs space was smaller (see
  caveats).

## Method

- **Workload.** The mixed workload of `perf/k6/mixed.js`: issue reads 30%, ⌘K keystrokes 20%
  (each asks Work's suggestions and every module's search), page reads 14%, board views 12%,
  issue edits 10%, comments 6%, issue search 4%, new issues 4%, plus page opens over `/collab`
  (one a second per 40 actions) and pairs typing into a page (one pair per 40 actions, at least
  three). An action is about 1.2 HTTP requests on average. Requests are dealt out across 200
  load-test people, so no one hits the per-person rate limit.
- **Concurrency ramp** (`perf/run-ramp.sh`, `perf/src/capacity.ts`). Each step holds a rate for
  5 minutes on the baseline data; the server's own p95 and p99 per route come from its latency
  histogram, CPU and memory from `docker stats`, pool use and queue depth from `/metrics`.
  The limit is the highest step inside every budget with errors under 0.1%; a step degrades
  when a budget breaks and breaks at 1% errors or four times a budget.
- **Data ramp** (`perf/src/grow.ts`, `perf/k6/data.js`). Holding the mixed workload at about
  half the size's limit, the data grows through supported bulk paths (the Jira importer, each
  project under its own key; Docs pages through the API) and a probe opens the largest Scrum
  board (its active sprint), the largest Kanban board (every unfinished issue), an issue, ⌘K, a
  page over `/collab`, the largest space's page tree and Docs search. Counts at each point are
  exact, from the database.
- **Baseline data** before the data ramp: 31,384 issues (LOADC 10,635, LOADB 10,282, LOADJ
  10,000, LOADA 500), 45,894 comments, 400 pages, 245 users. Writes during the runs add to it;
  each point below lists what the database held when it was measured.
- **Validity.** The harness ran on the same laptop as the VM. A step counts only if the host
  stayed at least 40% CPU idle throughout (sampled every 10 s); steps that fell below were
  re-run, and where a re-run could not get a quiet host either, the doc says so.

## Sizes

Postgres was retuned with the installer's formula (`deploy/installer/lib/config.sh`,
`tune_postgres`: shared_buffers an eighth of memory, at least 128 MB; effective_cache_size
three eighths) after each resize. The application's connection pool is a fixed 10 at every
size, as shipped.

| Size | MemTotal | shared_buffers | effective_cache_size | App pool |
| --- | ---: | ---: | ---: | ---: |
| 2 vCPU, 2 GB | 1,949 MB | 243 MB | 730 MB | 10 |
| 2 vCPU, 4 GB | 3,890 MB | 486 MB | 1,460 MB | 10 |
| 4 vCPU, 8 GB (ramp only) | 7,913 MB | 989 MB | 2,967 MB | 10 |

### 2 vCPU, 4 GB (the reference VM)

Concurrency ramp, server p95 in ms (page open is k6's, a WebSocket):

| Actions/s | People at once | Errors | Board | Issue | ⌘K suggest | ⌘K search | Page | Page open | Keystroke | App CPU | DB CPU | App RSS | Pool | Host idle | Verdict |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 40 | 200 | 0.00% | 36 | 25 | 24 | 36 | 25 | 83 | 5 | 74% | 140% | 509 MB | 3/10 | 42% | within |
| 80 | 400 | 0.01% | 68 | 32 | 32 | 40 | 34 | 39 | 5 | 61% | 77% | 522 MB | 6/10 | 42% | within |
| 100 | 500 | 0.00% | 425 | 497 | 432 | 384 | 525 | 291 | 14 | 73% | 142% | 543 MB | 8/10 | 1% | broken |
| 120 | 600 | 0.00% | 2,195 | 2,161 | 2,074 | 2,024 | 2,248 | 1,475 | 25 | 89% | 151% | 552 MB | 8/10 | 3% | broken |

The 100 and 120 steps were run twice and the host fell below 40% idle both times, so they are
not valid by the rule above. They agree with the first pass (broken from 100), and the 2 GB
size on a quiet host degraded but held at 100 (board 93 ms), so the real knee is somewhere
between 80 and 100 actions a second. 80 is the confirmed limit.

Data ramp, mixed workload at 40 actions a second, p95 in ms (server, except page open):

| Point | Issues | Comments | Pages | DB size | Issue | ⌘K search | Page | Page open | Page tree | Docs search | Scrum board¹ | Kanban board¹ | Verdict |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 37,501 | 54,885 | 5,200 | 0.47 GB | 16.5 | 29.6 | 17.3 | 23 | 24.9 | 22.2 | 128 (LOADJ, 10,000) | 39 (LOADA, 500) | within, but the Scrum board |
| 2 | 72,979 | 125,625 | 15,200 | 0.71 GB | 40.2 | 124.0 | 45.2 | 40 | 145.6 | 128.7 | 424 (LOADL, 25,000) | 244 (LOADK, 10,000) | over: issue, ⌘K, Docs search |
| 3 | 123,449 | 226,378 | 28,400 | 1.05 GB | 46.6 | 205.3 | 48.4 | 36 | 237.3 | 180.0 | 548 (LOADN, 30,000) | 429 (LOADM, 20,000) | over |
| 4 | 273,939 | 527,129 | 29,200 | 1.97 GB | 2,201 | 2,414 | 2,241 | 1,581 | 2,374 | 2,156 | 7,140 (LOADR, 100,000) | 6,076 (LOADQ, 50,000) | broken |

¹ k6's p95 for the largest project of each kind, with its issue count; board numbers are
before board paging (#159). The Scrum board shows the active sprint (about two thirds of an
imported project), the Kanban board every unfinished issue (three quarters).

The page counts at points 2 to 4 are inflated by the Docs import bug below (imports of more
than 200 pages were imported up to three times); the counts are the database's.

### 2 vCPU, 2 GB (partial)

Concurrency ramp, server p95 in ms:

| Actions/s | People at once | Errors | Board | Issue | ⌘K suggest | ⌘K search | Page | Page open | Keystroke | App CPU | DB CPU | App RSS | Pool | Host idle | Verdict |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 40 | 200 | 0.00% | 37 | 18 | 18 | 24 | 20 | 44 | 4 | 49% | 63% | 389 MB | 2/10 | 66% | within |
| 80 | 400 | 0.00% | 63 | 24 | 24 | 36 | 24 | 29 | 4 | 34% | 131% | 398 MB | 5/10 | 57% | within |
| 100 | 500 | 0.00% | 93 | 39 | 39 | 68 | 40 | 53 | 5 | 42% | 153% | 420 MB | 7/10 | 56% | degraded (board) |
| 120 | 600 | 0.00% | 1,055 | 873 | 739 | 735 | 1,270 | 841 | 5 | 51% | 160% | 420 MB | 8/10 | 53% | broken |

Data ramp, mixed workload at 40 actions a second, p95 in ms:

| Point | Issues | Comments | Pages | DB size | Issue | ⌘K search | Page | Page open | Page tree | Docs search | Scrum board¹ | Kanban board¹ | Verdict |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 42,835 | 61,570 | 2,000 | 1.32 GB | 16.6 | 24.9 | 18.2 | 23 | 23.9 | 23.1 | 160 (LOADJ, 10,000) | 20 (LOADA, 500) | within, but the Scrum board |
| 2 | 78,299 | 132,308 | 10,000 | 1.53 GB | 24.8 | 60.3 | 24.4 | 21 | 39.6 | 30.6 | 338 (LOADL, 25,000) | 214 (LOADK, 10,000) | within, but the boards |
| 3 | 128,797 | 233,024 | 25,000 | 1.74 GB | 42.5 | 238.8 | 40.4 | 38 | 187.5 | 192.0 | 803 (LOADN, 30,000) | 578 (LOADM, 20,000) | over: issue, ⌘K, page tree, Docs search |
| 4 | 279,270 | 533,775 | 25,000 | 2.29 GB | 310 | 984 | 425 | - | - | - | - | - | broken (not valid: host 38% idle) |

The 2 GB database file at points 1 to 3 is larger than its rows because the 4 GB run's data had
just been deleted (vacuumed, not compacted). The fourth point could not get a quiet host in two
attempts; it is broken by any reading and is shown for completeness only.

### 4 vCPU, 8 GB (not measured; preliminary ramp)

Concurrency ramp, server p95 in ms. The host was busy for most of it, so it is not used for
sizing:

| Actions/s | People at once | Errors | Board | Issue | ⌘K suggest | ⌘K search | Page | Page open | Keystroke | App CPU | DB CPU | App RSS | Pool | Host idle | Verdict |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 40 | 200 | 0.00% | 20 | 9 | 10 | 22 | 10 | 25 | 3 | 30% | 75% | 683 MB | 2/10 | 60% | within |
| 80 | 400 | 0.00% | 30 | 23 | 24 | 64 | 24 | 31 | 5 | 58% | 218% | 769 MB | 5/10 | 12% | within |
| 120 | 600 | 0.00% | 30 | 24 | 24 | 35 | 24 | 34 | 4 | 69% | 269% | 771 MB | 8/10 | 29% | within |
| 140 | 700 | 0.00% | 4,545 | 4,498 | 4,063 | 3,980 | 4,591 | 3,079 | 8 | 85% | 342% | 826 MB | 9/10 | 2% | broken |
| 160 | 800 | 2.02% | 9,651 | 9,173 | 7,443 | 7,509 | 9,792 | 5,081 | 26 | 214% | 337% | 877 MB | 9/10 | 0% | broken |

The 80 and 120 steps were each run twice and the host was busy both times (12–34% idle); both
runs were inside every budget, so 120 stands as the limit, with that caveat. **The pool:** at
the break, 9 of 10 connections were busy while Postgres still had about 15% of its four CPUs
free, so the fixed pool of 10 is a co-limit at this size; §20 sizes it at CPUs × 2 (8 here).

The data ramp at this size was stopped before a valid point: the host was below 1% idle
during both attempts at the first point.

## Bottlenecks found, with code paths

1. **Every new issue scans its whole project.** `modules/work/server/src/services/issues/create.ts`
   (line 138) runs `select max(rank) as rank from issues where project_id = $1` without
   `deleted_at is null`, so the partial index `issues_board_rank_idx (project_id, rank) WHERE
   deleted_at IS NULL` cannot serve it. It was the top on-CPU query at the 2 vCPU knee, and
   issue creation's p50 grows with project size (114 ms in a 13,000-issue project). Fix: #156.
2. **Issue numbers serialise every create in a project.** `insert into project_counters … on
   conflict do nothing` and `select next_number from project_counters … for update` were the
   most common lock waits at the knee. Fix: #156.
3. **Authorization lookups on every request.** Role, team, module-grant and capability reads
   (`packages/core/src/services/authz/authorize.ts`) are the next largest share of database
   time; per-process caching is planned with #156.
4. **Large boards load in one response** and every change refetches them for every viewer: a
   Scrum sprint of 6,700 cards is 128–160 ms, 16,700 is 340–420 ms, 67,000 is 7 s. Fix: board
   paging, #159.
5. **Docs imports over 200 pages fail after writing and retry, duplicating pages.**
   `modules/docs/server/src/services/transfer/index.ts:54` (`importNow`) publishes every page id
   at once through `modules/docs/server/src/services/common.ts:115` to
   `packages/core/src/services/realtime/notify.ts:44`, which allows 200; the job fails after the
   pages are committed and pg-boss retries it. Being fixed separately.
6. **Docs import runs at about 3 pages a second** on 2 vCPU (200 pages in 63 s), and creating a
   page through the API slows as a space grows (about 300 ms at 22,000 pages in one space,
   about 20 ms at 400).
7. **Deleting a project leaves its comments.** `comments` points at issues through `target_id`
   with no foreign key, and `modules/work/server/src/services/projects/index.ts:176` deletes the
   project row only, so 472,378 comments outlived their issues after the 4 GB run and had to be
   removed by hand.
8. **Job queues drain at 30 jobs a minute.** `packages/core/src/services/jobs/service.ts`
   (`batchSize: 1`, `pollingIntervalSeconds: 2`) takes one job per two-second poll, however
   cheap the job.
9. **A resize does not retune Postgres.** The installer tunes for the memory it finds once;
   after a resize the old values stay. `bemmoly doctor` should notice and offer to retune.
10. **The pool is a fixed 10**, where §20 says CPUs × 2; at 4 vCPU it is a co-limit (above).

## Caveats

- **Laptop VMs, not cloud instances.** Lima VMs (Apple Virtualization) on an Apple Silicon
  laptop with 14 cores, with k6 on the same laptop reaching the VM through a port forward. Cloud
  vCPUs are often slower than Apple Silicon cores and network paths differ; treat these as
  relative sizes and orders of magnitude, and leave headroom.
- **The laptop was shared.** Other work ran during the night; validity was judged by host CPU
  idle, and steps that could not get a quiet host are marked.
- **Before #156 and #159.** The bottlenecks above are being fixed; the limits will move.
- **Comments and links come from the Jira importer's fake site** (two comments and a link per
  issue), and pages from generated text of about 400 words; real data is lumpier.
- **The 4 GB data ramp's later points carry duplicated pages** from the Docs import bug, which
  makes its Docs numbers a little pessimistic beside the 2 GB run's.
