# @bemmoly/site

## 0.3.0

No changes in this release.

## 0.2.2

### Patch Changes

- 36d67a5: bemmoly.com leads with "Keep your work in-house." and has a live demo at /demo: the real app on
  sample data, running in the visitor's browser with no server behind it, signed in and reset on
  every reload. The homepage's product shot is now a live preview of it (the board, an issue and
  the workflow editor) that loads only when someone presses Try it. Every feature on the homepage
  carries a status badge, so Docs (0.3), AI (0.4) and what follows read as coming rather than
  shipped, and every page names one version, the newest release. The web app gains a demo build
  (`pnpm --filter @bemmoly/web build:demo`) used only by the site; installs are unchanged, with no
  configuration or schema change.

## 0.2.1

### Patch Changes

- 4b5880a: bemmoly.com gains an install guide and a Docker Compose guide under /docs (the addresses the
  installer's messages already point at), four pages on self-hosted project management, the issue
  tracker, Kanban and Scrum boards and keeping data on your own server, and a changelog built from
  the release notes, with an RSS feed at /changelog.xml. Every page has its own title,
  description, structured data and sitemap date; old `.html` and trailing-slash addresses redirect
  to the clean ones, and the installer host stays out of search results. The site no longer cuts
  off the hero on narrow phones or drops the space beside links. Site only: no change to the app,
  its configuration or its schema.

## 0.2.0

No changes in this release.

## 0.1.7

No changes in this release.

## 0.1.6

No changes in this release.

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

## 0.1.4

No changes in this release.

## 0.1.3

No changes in this release.

## 0.1.2

No changes in this release.

## 0.1.1

No changes in this release.

## 0.1.0

No changes in this release.
