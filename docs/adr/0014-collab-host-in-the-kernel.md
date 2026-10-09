# ADR 0014: The collaboration host lives in the kernel and modules register document kinds

- Status: accepted
- Date: 2026-10-10
- Tech design: [§15 Docs engine](../tech-design.html#docs),
  [§9 API, realtime and webhooks](../tech-design.html#api),
  [§13 Background jobs and realtime](../tech-design.html#jobs),
  [§10 Security](../tech-design.html#security)

## Context

The tech design serves Yjs documents with Hocuspocus "mounted on the same Fastify server at
`/collab`", authenticated "with the session cookie on upgrade", with a persistence extension
writing `page_updates` and a debounced hook extracting the snapshot. It leaves open where the
server lives (the kernel never imports a module, yet the documents are Docs pages), how other
modules would add collaborative documents, how updates are batched, how limits apply to a
socket and what happens on shutdown and across replicas.

## Decision

1. **The kernel owns the host; modules register kinds.** `ctx.collab.add({ kind, authorize,
   load, store, onChange })`. Document names are `<kind>:<id>`, and kinds are namespaced by
   module (`docs.page`), as search kinds are. The kernel never learns what a page is.
2. **One upgrade path for both sockets.** `@fastify/websocket` is registered once (it owns the
   HTTP `upgrade` event), with the larger of the two message limits; `/ws` enforces its own
   16 KiB. `/collab` reuses the `/ws` checks: a resolved session cookie and a same-origin
   `Origin` header, or no socket. Hooks never see the cookie.
3. **Authorization per document, in this order:** module enabled, module access for the
   person, then the module's `authorize`, which returns `write`, `read` or `deny` with the
   person's own request context. `read` opens the document read-only: the person receives
   every update and Hocuspocus drops their writes. A refusal sends the error code
   (`forbidden`, `module_access_denied`, `not_found`) as the reason.
4. **Every update is persisted, in order, through the module.** A per-document writer calls
   `store` one at a time; updates that arrive while a store runs are merged per actor into the
   next call, so a burst of typing becomes a few rows. A failed store is retried with backoff
   and never skipped, since a gap in a Yjs log strands every later update.
5. **`onChange` is debounced 2 s** (at most every 10 s while typing continues) and also runs on
   unload and on shutdown, with the people who edited since the last call.
6. **Limits are per socket and in memory:** 2 MiB per message and 600 messages per 10 s by
   default (`BEMMOLY_COLLAB_MAX_MESSAGE_BYTES`, `BEMMOLY_RATE_LIMIT_COLLAB_MESSAGES`); a socket
   over either is closed (1009, 1008) and the client reconnects with backoff. A socket lives
   on one process, so there is nothing to share through Postgres as the HTTP limits do.
7. **Graceful shutdown** runs in Fastify's `preClose`: close the sockets, run pending
   `onChange` calls, and wait for every queued update to be stored while the pool is open.
8. **Server-side edits** (`ctx.collab.transact`) go through a Hocuspocus direct connection, so
   open editors see them and they are stored like any other update.

## Consequences

- Docs registers `docs.page`; Work or a later module can make another record collaborative
  with one registration and no kernel change.
- Collaboration needs one API replica per document. Two replicas holding the same page would
  each persist correctly (Yjs merges both logs on the next load) but would not relay live
  edits to each other. The default install runs one process; a multi-replica install should
  route `/collab` with session affinity until a Postgres `NOTIFY` relay is added.
- Hocuspocus 4 is a runtime dependency of the kernel, and `yjs` of the kernel and of any
  module that registers a kind.

## Alternatives considered

- **The host inside the Docs module.** Simplest today, but the module would own an HTTP
  upgrade, its own session check and its own shutdown, and the next collaborative record
  would duplicate all of it.
- **Hocuspocus's own `Server` on a second port.** Breaks "same Fastify server at `/collab`",
  needs its own proxy rule and its own authentication.
- **One row per update, written synchronously.** Matches the log literally, but costs a
  write per keystroke per person; merged batches keep the same order and content.
