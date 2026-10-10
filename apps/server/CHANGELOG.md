# @bemmoly/server

## 0.2.2

### Patch Changes

- @bemmoly/module-sample@0.2.2
  - @bemmoly/module-work@0.2.2
  - @bemmoly/core@0.2.2
  - @bemmoly/shared@0.2.2

## 0.2.1

### Patch Changes

- Updated dependencies [ca5b2c4]
  - @bemmoly/module-work@0.2.1
  - @bemmoly/module-sample@0.2.1
  - @bemmoly/core@0.2.1
  - @bemmoly/shared@0.2.1

## 0.2.0

### Minor Changes

- d313831: The Work module ships in the image, off until an admin enables it in Settings › Modules.
  Enabling it runs its schema changelog, which creates the issue tracking tables (projects,
  issue types and fields, workflows, issues, links, labels, versions, components, sprints,
  boards, saved filters, comments, history, work logs, watchers, attachments and automation
  rules) and adds the pg_trgm extension for prefix search, which needs the database owner or a
  superuser to have created it on managed databases that do not allow trusted extensions. Once
  enabled, "Board" and "Backlog" appear in the top navigation as placeholders and the Work
  capabilities (create and configure projects; view, create, edit, move and delete issues;
  manage sprints; configure the board) appear in the roles matrix with their defaults. The
  screens and the API behind them arrive in later changes of this release. No configuration
  change.

### Patch Changes

- Updated dependencies [dcbcae4]
- Updated dependencies [7d09c70]
- Updated dependencies [e2aa5d2]
- Updated dependencies [51cd3ae]
- Updated dependencies [e2aa5d2]
- Updated dependencies [c646c34]
- Updated dependencies [66e9507]
- Updated dependencies [83c390e]
- Updated dependencies [cab0760]
- Updated dependencies [a28fa79]
- Updated dependencies [80faa4d]
- Updated dependencies [158db6a]
- Updated dependencies [e2aa5d2]
- Updated dependencies [72bd7b9]
- Updated dependencies [e2aa5d2]
- Updated dependencies [d313831]
- Updated dependencies [7d09c70]
- Updated dependencies [b4f5ea9]
- Updated dependencies [9c7de90]
- Updated dependencies [4d5e58f]
- Updated dependencies [7625bb6]
- Updated dependencies [5935186]
- Updated dependencies [7d09c70]
  - @bemmoly/core@0.2.0
  - @bemmoly/module-work@0.2.0
  - @bemmoly/shared@0.2.0
  - @bemmoly/module-sample@0.2.0

## 0.1.7

### Patch Changes

- @bemmoly/module-sample@0.1.7
  - @bemmoly/core@0.1.7
  - @bemmoly/shared@0.1.7

## 0.1.6

### Patch Changes

- Updated dependencies [a13da15]
  - @bemmoly/core@0.1.6
  - @bemmoly/module-sample@0.1.6
  - @bemmoly/shared@0.1.6

## 0.1.5

### Patch Changes

- 0278663: Sign-in, password reset and invitation accept are now rate limited per account as well as per
  address. Before this fix, someone using many addresses could keep guessing one person's
  password, or keep sending them reset emails. Each account now gets 10 attempts per route every
  15 minutes, whether or not the address belongs to anyone, and the 11th gets `429 Too Many
Requests` with a `Retry-After` header. A real person locked out by someone else's guessing can
  sign in again when the 15 minutes are up. An address that keeps presenting session cookies or
  API tokens the server refuses is turned away for the rest of the minute after 60 refusals,
  before any more are checked; valid sessions and tokens never count against this.

  All limits stay on, and each maximum can now be set in the environment (empty keeps the
  default): `BEMMOLY_RATE_LIMIT_PER_USER` (API requests per person per minute, 600),
  `BEMMOLY_RATE_LIMIT_AUTH_PER_IP` (anonymous auth requests per address per route per minute, 10),
  `BEMMOLY_RATE_LIMIT_AUTH_PER_ACCOUNT` (attempts per account per route per 15 minutes, 10) and
  `BEMMOLY_RATE_LIMIT_FAILED_CREDENTIALS_PER_IP` (refused credentials per address per minute,
  60). Behind a reverse proxy, keep `BEMMOLY_TRUST_PROXY=true` so limits apply to client
  addresses rather than the proxy's. Also fixed: a few text helpers that could stall on unusual
  input with long runs of `/` or `@` now run in linear time. No schema change.

- Updated dependencies [0278663]
  - @bemmoly/core@0.1.5
  - @bemmoly/module-sample@0.1.5
  - @bemmoly/shared@0.1.5

## 0.1.4

### Patch Changes

- Updated dependencies [b98d0c0]
  - @bemmoly/core@0.1.4
  - @bemmoly/module-sample@0.1.4
  - @bemmoly/shared@0.1.4

## 0.1.3

### Patch Changes

- @bemmoly/core@0.1.3
  - @bemmoly/module-sample@0.1.3
  - @bemmoly/shared@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies [8337385]
- Updated dependencies [8337385]
  - @bemmoly/core@0.1.2
  - @bemmoly/shared@0.1.2
  - @bemmoly/module-sample@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies [a2b7f81]
  - @bemmoly/core@0.1.1
  - @bemmoly/module-sample@0.1.1
  - @bemmoly/shared@0.1.1

## 0.1.0

### Patch Changes

- Updated dependencies [293b01b]
- Updated dependencies [b403d58]
- Updated dependencies [c7e5a48]
  - @bemmoly/core@0.1.0
  - @bemmoly/shared@0.1.0
  - @bemmoly/module-sample@0.1.0
