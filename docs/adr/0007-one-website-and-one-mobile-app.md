# ADR 0007: One website and one mobile app for every module

- Status: accepted
- Date: 2026-10-07
- Tech design: [§4 Modules](../tech-design.html#modules), [§25 Open decisions](../tech-design.html#decisions)

## Context

Bemmoly grows by modules: Work, Docs, and whatever comes next. Each could be its own site on
its own subdomain with its own mobile app, which gives independent deploys and natural
per-product branding. It also means several logins, a duplicated shell, cross-service calls for
every cross-module feature (an issue embedded in a page, a page linked from an issue) and a
multi-host install for people who wanted one container.

## Decision

1. One website. Modules are sections of a single shell routed by path (`/work`, `/docs`),
   shown only to people with access. Vanity hosts such as `docs.example.com` are proxy
   rewrites to the path, not separate deployments.
2. One mobile app named Bemmoly. It reads the module manifest from the server and shows only
   the modules the person can open, so a Docs-only workspace looks like a docs app.
3. Sequencing: the web app ships as an installable PWA with web push for 1.0. A native shell
   follows after 1.0 and loads module screens by manifest, so a new module never needs a new
   app in the stores.

## Consequences

- One login, one session, one notification registration, and deep links that cross modules.
- The shell, navigation, command palette and settings frame are built once.
- Lazy module chunks keep the initial download small, which is the main benefit separate apps
  would have had.
- Module teams cannot ship a different shell or release cadence; modules release with the
  product.

## Alternatives considered

- **A site and an app per module.** Independent deploys and branding, at the cost of SSO
  complexity, duplication and an install that is no longer one host.
