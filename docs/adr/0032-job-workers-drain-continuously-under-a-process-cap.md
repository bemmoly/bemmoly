# ADR 0032: Job workers drain continuously, under one cap per process

- Status: accepted
- Date: 2026-10-11
- Changes: tech design §13 ("the worker loop runs inside the single process with a concurrency
  cap"), which named the cap but not how a queue fetches
- Evidence: pg-boss 12.37.0 (`dist/worker.js`, `dist/manager.js`); a 0.12.0 install where no-op
  jobs started exactly 2 s apart and a backlog of 5,800 jobs took over 3 hours to drain

## Context

Each queue was worked with `batchSize: 1`, `localConcurrency: concurrency ?? 1` and a 2 s
polling interval. A pg-boss worker sleeps out its polling interval after every fetch, including
one that found a job, so every queue topped out at one job per worker per 2 s: about 30 a
minute, however cheap the jobs. Email sends, notifications, digests, imports, AI and retrieval
all queue behind that.

pg-boss has two ways to skip the sleep. Its burst options (`burstWhenBatchFull`) engage only for
`batchSize` above 1, and a batch shares one handler deadline and one failure: a slow job times
out the whole batch and a thrown error fails jobs that already finished, so they run twice.
`burstWhenReadyExceeds` works at batch size 1 but reads a stats cache refreshed every 60 s or so,
so a burst would wait up to two minutes before it drained. LISTEN/NOTIFY wakes workers on new
jobs but not while they work through a backlog that already exists.

Job handlers run on the request pool (10 connections). Faster queues mean more handlers at
once, and the pool fix that added the acquire timeout made a starved pool answer requests with
503, so jobs must not be able to take every connection.

## Decision

1. **Every queue keeps `batchSize: 1`.** Retries, expiry, the abort signal and the singleton
   policy stay per job, exactly as before.
2. **One fetch loop per unit of `concurrency`, and a loop whose job succeeded fetches again at
   once.** Each loop is its own pg-boss worker; after a successful job the handler calls
   `notifyWorker` on it, which pg-boss documents as skipping the next polling interval. An
   empty fetch falls back to the 2 s poll, and so does a failure, so a queue whose jobs all fail
   (a mail server down) does not spin through its retries.
3. **One process-wide cap on handlers running at once.** A handler waits for a slot, in arrival
   order across queues, so a busy queue cannot starve the others. The server derives the cap
   from its pool: 4 of 10 connections where one process serves requests and jobs (`all`), 8
   where it only runs jobs (`worker`). A queue never gets more loops than the cap.
4. **`concurrency` stays the per-queue knob, defaulting to 1.** One loop already drains
   hundreds of cheap jobs a second, so heavy queues (backups, imports, AI) keep 1 or what they
   set. Cheap fan-out queues whose handlers claim rows with `skip locked` set more:
   `email.send` and `notifications.digest` run 4 at once.

## Consequences

- A backlog drains as fast as its handlers finish: 500 no-op jobs take about 1 s instead of
  about 17 minutes, and an idle queue still polls only every 2 s.
- A job fetched while every slot is busy is already claimed while it waits, and the wait
  counts toward its expiry. Waits are bounded by the handlers ahead of it; the default expiry
  is 15 minutes. A wait ends as soon as the job's signal aborts.
- No new environment key. A deployment that needs more job throughput runs a `worker` process.
- pg-boss's own pool (4 connections) still carries fetches and completions; it is separate from
  the request pool and unchanged.
