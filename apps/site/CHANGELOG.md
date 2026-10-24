# @bemmoly/site

## 1.4.0

### Minor Changes

- c7a4069: The Jira alternative page has a savings calculator: enter your team size and pick a Jira plan
  (Standard or Premium) to see the subscription you would stop paying each month and each year.
  It uses Atlassian's public per-user list prices, dated on the page, and states the one cost that
  remains with Bemmoly, the server you run it on. No configuration or schema change.

## 1.3.0

No changes in this release.

## 1.2.0

No changes in this release.

## 1.1.0

### Patch Changes

- a332774: The star count on the site header's Star on GitHub button is refreshed in the browser on each
  visit, so it no longer stays at the number from the last deploy.

## 1.0.0

### Minor Changes

- 2d0dcaa: Server sizing leads with the measured tier: 2 vCPU, 4 GB tested with 100,000 issues, latency
  bars, prices by provider with sources and checked dates, and an estimator on /sizing that
  recommends a size only where it was measured. The card sits just before Install on
  /self-hosting; /sizing adds the method and the full price table.
- 09c9aae: A sizing page, /sizing, and a sizing section on /self-hosting: three server sizes from measured
  load tests (src/data/capacity.json), the people estimate's assumption written out, and monthly
  prices by cloud.

### Patch Changes

- c5849e4: Queue depth counts only jobs that can run now: `bemmoly_job_queue_depth` and `bemmoly status`
  no longer include scheduled jobs such as digests, which show apart as
  `bemmoly_job_queue_delayed` and `queueDelayed`. `bemmoly sync-updater` no longer prints an older
  updater's usage line or restarts the app. `bemmoly doctor` warns when Postgres is tuned for a
  different machine size, and the new `bemmoly tune` re-applies the tuning after a resize, asking
  before it restarts the database.

## 0.13.1

No changes in this release.

## 0.13.0

No changes in this release.

## 0.12.0

No changes in this release.

## 0.11.0

No changes in this release.

## 0.10.0

No changes in this release.

## 0.9.0

No changes in this release.

## 0.8.0

### Minor Changes

- 31f9a87: Themes and modes. The eight presets become five themes, each designed in light **and** dark:
  Bemmoly (the default, the logo's blue), Graphite, Sand, Pine and High contrast. Mode is now its own
  choice: Light, Dark or Match system, which really follows the computer's setting, live. Each
  person's mode is saved on their account and follows them to every device; the workspace sets the
  default theme and the default mode (new workspaces follow the system). The typeface is a separate
  setting. Admins can make a **custom theme** from one brand colour and a surface style: Bemmoly
  builds checked light and dark versions, adjusts them until text and buttons pass contrast, warns
  when the colour is close to one that already means something (errors, warnings, done, AI), and
  never recolours the logo. A custom theme can be the workspace default, and when personal themes
  are on, people can pick any theme, or make their own, from the user menu. In dark mode Task and
  Epic tiles are lighter so they stay readable.

  Upgrading changes nobody's look: Classic, Dark, Midnight, Ocean and Rose become Bemmoly in their
  old mode, Slate becomes Graphite, Warm becomes Sand and Forest becomes Pine; each workspace keeps
  its mode as the default mode and keeps its typeface. A custom brand colour becomes a workspace
  custom theme. Choices saved in a browser move to the account on the next sign-in.

  Admins: the schema adds the kernel changeset `0600-appearance-themes` (the `custom_themes` and
  `user_appearance_preferences` tables, and a rewrite of the stored `appearance.*` settings). It is
  reversible and quick. New settings: `appearance.defaultMode` and `appearance.customThemeId`.
  `appearance.mode`, `appearance.surfaces` and `appearance.memberModeSwitch` are no longer used and
  will be removed in a later release. New endpoints: `GET`/`PUT /api/v1/me/appearance` and
  `/api/v1/themes`. The demo takes `?theme=pine&mode=dark`.

## 0.7.0

No changes in this release.

## 0.6.0

No changes in this release.

## 0.5.0

### Patch Changes

- b665413: bemmoly.com is rebuilt around the three things that set Bemmoly apart: 100% open source, no
  pricing and no in-app purchases. The homepage leads with "Your work. Your platform.", the install
  command with a copy button that confirms, and the new UI in four views (Board, a Docs page, an
  Issue, the Backlog) that start the live demo in place, with honest loading and failure states.
  Each promise and each self-hosting fact links to the file in the repository that proves it, and
  a test fails the build if that file loses the line. Work and Docs are shown with real screens,
  AI is an honest "coming, optional" band in its lilac, and the page answers how it is free, what
  the catch is and who maintains it. The site takes the product's tokens, drawn icons and lockup,
  follows the system into the product's dark theme with a footer control, and gets a phone menu.
  Stale claims are gone site-wide: AI promised for 0.4, Docs and import badged as coming, an
  unmeasured "5 minutes", an absolute "data never leaves" and a Discord link with no invite. Site
  only: no change to the app, its configuration or its schema.
- 019bbee: The "How is it free?" answer on bemmoly.com now says that sponsoring the project on Buy Me a
  Coffee is optional, supports development and unlocks nothing: every feature is in the free
  product.

## 0.4.0

No changes in this release.

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
