# @bemmoly/core-web

## 0.1.7

### Patch Changes

- @bemmoly/shared@0.1.7

## 0.1.6

### Patch Changes

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

- @bemmoly/shared@0.1.5

## 0.1.4

### Patch Changes

- @bemmoly/shared@0.1.4

## 0.1.3

### Patch Changes

- @bemmoly/shared@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies [8337385]
- Updated dependencies [8337385]
  - @bemmoly/shared@0.1.2

## 0.1.1

### Patch Changes

- @bemmoly/shared@0.1.1

## 0.1.0

### Patch Changes

- Updated dependencies [b403d58]
  - @bemmoly/shared@0.1.0
