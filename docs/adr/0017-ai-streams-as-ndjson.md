# ADR 0017: Streamed AI replies are NDJSON over the request that asked

- Status: accepted
- Date: 2026-10-11
- Tech design: [§9 API](../tech-design.html#api) (`/api/v1/ai/*`),
  [§11 AI subsystem](../tech-design.html#ai)

## Context

Two AI surfaces write text a person watches arrive: Ask your docs (`POST /api/v1/ai/answers`)
and the doc editor's `/ai` commands and Ask AI
(`POST /api/v1/docs/pages/:pageId/ai-writes`). Each reply is more than text: an answer sends
its sources before the first word and ends with an outcome and the `ai_runs` id that "Not
useful" marks; a write can fail halfway with a provider error the card must say plainly.

The tech design said `POST /ai/ask` "streams" without naming a format. The realtime channel
(WebSocket plus `LISTEN/NOTIFY`, §8) carries small invalidation messages to every replica, not
one person's tokens.

## Decision

1. A streamed AI reply is the response body of the request that asked for it, as NDJSON
   (`application/x-ndjson`): one JSON object per line, flushed as it is produced.
2. Every line is one event of a discriminated union in `@bemmoly/shared`, validated on both
   ends: an answer is `sources`, then `delta`s, then exactly one `done` or `error`; a write is
   `text` lines, then `done` with its run id, or `error`.
3. A refusal (AI off, role unset, budget reached, opted out, excluded) is an ordinary 403 before
   the stream starts, so clients handle it like any other error. Only failures after the first
   byte travel as an `error` line.
4. The client reads every stream through one reader, `http.lines(path, schema)` in
   `@bemmoly/api-client`, which yields parsed lines and aborts with the request's signal.

## Consequences

- One request, one response: auth, CSRF, rate limits, request ids and logs work unchanged, and
  closing the card aborts the request, which aborts the model call.
- No sticky sessions or fan-out: a reply never crosses replicas, so `api` processes scale out
  without a broker.
- The mock backend and tests stream the same lines, so the web app runs against the demo and
  Playwright exactly as against the server.
- A proxy that buffers bodies would hold the stream back. The routes send
  `cache-control: no-store` and no length, and Caddy's reverse proxy passes a body of unknown
  length on as it arrives; an operator's own proxy must do the same.
- Resuming a reply after a dropped connection is not supported; asking again is cheap and
  the card offers Try again.

## Alternatives considered

- **Server-sent events.** `EventSource` cannot POST or send our headers, so it would need a
  second request to start the reply; a fetch-based SSE parser is what NDJSON already is,
  with a framing format on top.
- **The realtime WebSocket.** Built for invalidations to many tabs; per-token traffic would
  share its rate limits and need a correlation id to find the asking card.
- **Wait for the whole reply.** Simplest, but a long answer would sit on a spinner for seconds,
  which the AI design rules forbid.
