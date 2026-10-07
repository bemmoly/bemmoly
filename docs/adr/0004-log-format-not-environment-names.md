# ADR 0004: LOG_FORMAT chooses the log output, not the environment's name

- Status: accepted
- Date: 2026-10-07
- Tech design: [§19 Configuration model](../tech-design.html#config), [§21 Observability](../tech-design.html#observability)

## Context

Production needs pino's JSON lines for log shipping; a developer at a terminal wants readable
output. The usual way to choose is to branch on `NODE_ENV === 'production'`. The configuration
model forbids branching on environment names: differences between development, demo and
production are values, so that the code path an admin runs is the one that was tested.

## Decision

1. A `LOG_FORMAT` key (`json` or `pretty`, default `json`) in `config/env.ts` decides the
   output. `pretty` loads `pino-pretty` as a transport; `json` writes lines directly.
2. `pnpm dev` writes `LOG_FORMAT=pretty` into the generated `apps/server/.env`. The image and
   the installer leave it unset, so production gets JSON without anyone remembering to.
3. No code reads `NODE_ENV` or any other environment name to change behaviour. The lint rule
   on `process.env` and the Semgrep rule keep it that way.

## Consequences

- Readable logs on a laptop and machine-readable logs everywhere else, with one code path.
- Anyone can get JSON locally (to test a log query) or pretty output on a server (to debug
  over SSH) by setting one key.
- The redaction list, request id and user-id hashing apply identically in both formats,
  because they are configured before the transport.
- One more key in `.env.example`, documented with its default.

## Alternatives considered

- **Branch on `NODE_ENV`.** Violates the configuration model and couples unrelated behaviour
  (libraries also read `NODE_ENV`) to log formatting.
- **Detect a TTY.** Surprising under process managers and in CI, where output is piped.
