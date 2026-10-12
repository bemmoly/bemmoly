# ADR 0036: Authorization lookups cached per process, emptied by a database notification

- Status: accepted
- Date: 2026-10-12
- Changes: the tech design's three authorization layers (module access, membership,
  capability), which were looked up per request; the request-scoped cache in
  `services/authz/authorize.ts` stays, with a process cache under it
- Evidence: load test on the 2 vCPU / 4 GB reference VM, capped at about 80 requests a second
  with Postgres CPU the bottleneck; five to six authorization reads per request (role and
  status, teams, module grants, role capabilities, project overrides, membership, API token)

## Context

Every request checked module access, membership and capability from scratch: a fresh
`createRequestAuthorization` per request, with a cache that lived only as long as the request.
Those reads are small but they are most of the statements a cheap read sends, and they are the
same answers for every request a person makes in a second.

Caching them across requests trades freshness for load. The trade is only acceptable if taking
access away (a revoked token, a deactivated person, a removed member, a role or grant changed)
still takes effect at once on every replica, not "eventually".

## Decision

1. **One cache per process, five seconds at most.** `AuthorizationCache`
   (`services/authz/shared-cache.ts`) keeps principals, module sets, memberships, resolved
   capability sets and API token rows. The server passes `processAuthorizationCache` to the
   authentication middleware and to `contextFor`; MCP connections, tests and tools that write the tables
   directly keep the per-request cache only.
2. **Postgres says when to forget.** Kernel changeset `0114-identity-authz-notify` puts
   triggers on `roles`, `role_capabilities`, `team_members`, `module_grants`,
   `project_members`, `space_members`, `project_role_capabilities`, `space_role_capabilities`,
   and on `users` and `api_tokens` for the columns that grant or take away access (not
   `last_seen_at` or `last_used_at`). They `pg_notify('bemmoly_authz')`, which is delivered when
   the writing transaction commits, to every process with a LISTEN on the channel. The realtime
   listener clears the whole cache on each one, and again whenever its connection
   (re)connects, since anything sent while it was down was lost.
3. **The TTL is the fallback, not the mechanism.** If the LISTEN connection is down, no answer
   is used for longer than five seconds. A cleared cache never takes back a load that was in
   flight when it was cleared, and a failed load is never kept.
4. **Inside a transaction, the database.** `authz.within(tx)` bypasses the process cache, so a
   service that changes a membership and then checks it sees its own write.
5. **Expiry is checked on every call.** A cached API token row is compared with the request's
   clock each time; only revocation and owner status rely on the notification.

## Consequences

- With the listener up, a change takes effect as soon as it commits, on every replica. Without
  it (Postgres restart, network cut), a change may take up to five seconds to apply. The tests
  in `shared-cache.int.test.ts` hold both.
- Session cookies are unaffected: the session lookup already reads the person's status on
  every request and still does.
- Clearing the whole cache on any change is coarse but cheap: access changes are rare next to
  requests, and the cache refills within one request per person.
- A new table that grants access needs its own trigger in a changeset, or its changes wait for
  the TTL. Module tables that only scope reads (projects, spaces) do not.
