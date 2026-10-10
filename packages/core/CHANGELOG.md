# @bemmoly/core

## 0.4.1

### Patch Changes

- Updated dependencies [db35948]
  - @bemmoly/ui@0.4.1
  - @bemmoly/shared@0.4.1

## 0.4.0

### Minor Changes

- 2ab05df: Bemmoly takes on its logo's colours and a quieter visual system. The accent is the logo blue
  (the mid blue in dark mode), AI is the logo lilac and nothing else, and epics have their own
  violet. Every text grey now reads at 4.5:1 or better on every surface in every theme, so muted
  text that was hard to read is fixed everywhere at once, and the Midnight and Ocean themes get
  readable primary buttons. Type, radii and shadows are fewer and consistent.

  Icons are drawn instead of typed, so they look the same on every computer: issue types are
  tiles with a drawn mark, priority is three neutral bars with only the most urgent level in red,
  and keyboard shortcuts are drawn keys ("Ctrl" off Apple platforms). Custom issue types show
  their own icon and colour instead of a task's, and Settings › Issue types shows every type's
  icon rather than a stored character. Status pills follow their category, so In review and QA
  read as in progress (blue). Avatars are solid colours with white initials, labels are outlined
  pills with their own colour, and project, team and module tiles share one shape.

  Workspace logo colours no longer recolour the Bemmoly mark under a custom theme. Tooltips name
  their shortcut, deleting something reversible shows Undo for six seconds, relative times show
  the full date on hover, and every keyboard focus shows the same ring.

  Workflow status colours stored by earlier versions are drawn as their nearest new colour, and
  the issue type icon field now takes an icon name of up to 40 characters. No configuration or
  schema change.

- 8f4df5f: The Board can now select cards like the Backlog: tick a card's corner, Shift-click for a range or
  ⌘-click for one more, and the same bar assigns, sets priority, moves to a sprint or deletes them
  with Undo. A Display menu on the Board lets each person choose the card fields, a compact density
  and whether empty columns show; it never changes the board for anyone else.

  Assigning, changing priority and moving to a sprint from a card, a row, the issue menu or the bulk
  bar now shows at once, dims the issue until the server answers, puts it back if the change is
  refused, and offers Undo. The Board, Backlog and Issue page show who else is looking at them.
  Issues can be linked from their menu on the Board and Backlog.

  Every icon button has the same tooltip, with its shortcut. Epics keep their colour on every
  screen, project and space tiles are drawn the same everywhere, and labels that shouted in
  capitals are now in sentence case. On a phone the Backlog keeps each issue's title and the
  sprint's name, and Board lanes keep the epic's name. Home's My issues moves with j and k, an issue
  created over a Scrum board joins the running sprint, and the loading screen follows the theme you
  last used.

  Someone who opens an issue in a project they are not a member of is now told so, and who can add
  them, instead of being told the server did not answer.

  Live updates and presence over the realtime connection are now limited to the people who can open
  the project or space, as the project and space lists already were.

### Patch Changes

- Updated dependencies [e7df029]
- Updated dependencies [ab5214d]
- Updated dependencies [2ab05df]
- Updated dependencies [8f4df5f]
- Updated dependencies [bb4a602]
- Updated dependencies [e5697e8]
- Updated dependencies [d568104]
- Updated dependencies [259e195]
  - @bemmoly/ui@0.4.0
  - @bemmoly/shared@0.4.0

## 0.3.0

### Minor Changes

- 27dec1d: The server now hosts live collaborative documents at `/collab`, on its own port and
  authenticated with the session cookie. Every change is stored in Postgres as it happens and
  survives restarts; a page's text, word count, search index and links update two seconds after
  typing stops.

  Two new optional environment keys cap each editing connection; empty keeps the default.
  `BEMMOLY_COLLAB_MAX_MESSAGE_BYTES` is the largest message one socket may send, from 64 KiB to
  16 MiB (2 MiB by default). `BEMMOLY_RATE_LIMIT_COLLAB_MESSAGES` is how many document messages
  one socket may send per 10 seconds (1200 by default); caret and selection updates count
  separately, up to three times that, so moving the caret never spends the typing budget. A
  socket over a limit is closed and the editor reconnects on its own, keeping what was typed.
  Measured in a browser, the fastest key repeat with the caret moving sends about 70 messages a
  second, half of them carets, so the defaults leave room for two people typing flat out.

  Run one API process per install for live editing; with several, route `/collab` with session
  affinity. The bundled Caddy configuration keeps editing connections open across a
  configuration reload. No schema change.

- 27dec1d: For module authors and API clients, the kernel gains what let Docs and Work point at each
  other without importing each other. `ctx.entities.resolve` finds a record any enabled module
  registered, by id or key, filtered to what the person may see; `ctx.entities.resolveMany` does
  it for a whole list in one batch, and `EntitySummary` can carry the facts a renderer shows,
  such as an issue's status. `EntityDefinition.canView` now receives the request context.
  `ctx.links.addReferenceSource` and `ctx.links.referencesTo` answer "what points at this record"
  across modules, which is how an issue lists its linked docs. A module that ships
  `web/src/entities.tsx` lends a chip, card, table and search for the records it owns, and other
  modules' screens draw them through `useEntityRenderer(kind)`, keeping a placeholder while the
  owner is off. Work registers its issues, so Docs pages show live issue chips and tables. In the
  web kernel, `preloadable` and `useLoaded` load a lazy screen before rendering it, and module
  chunks now load that way, so opening a module no longer waits out React's 300 ms Suspense
  reveal.

  Deprecated: `PATCH /api/v1/docs/pages/:id` still accepts `snapshot` and applies it as one live
  edit, but write page bodies through `/collab`; the field is removed in 0.4. No configuration or
  schema change.

### Patch Changes

- Updated dependencies [27dec1d]
- Updated dependencies [27dec1d]
  - @bemmoly/ui@0.3.0
  - @bemmoly/shared@0.3.0

## 0.2.2

### Patch Changes

- @bemmoly/shared@0.2.2
  - @bemmoly/ui@0.2.2

## 0.2.1

### Patch Changes

- @bemmoly/shared@0.2.1
  - @bemmoly/ui@0.2.1

## 0.2.0

### Minor Changes

- dcbcae4: Modules can now write the kernel's audit log. The module context carries an audit recorder
  whenever the database is present, so a module records who created a project or overrode a
  scheme in the same audit log that settings changes use, inside its own transaction. No
  configuration or schema change.
- 7d09c70: Modules can now manage who belongs to a project or a space. The module context carries a
  membership service whenever the database is present: list the members with their role, add
  people or whole teams (each team member takes the team's default role, everyone else Member,
  unless a role is named), change a member's role and remove a member, inside the module's own
  transaction. Access follows on the next request, since authorization reads membership every
  time. No configuration or schema change.
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

- e2aa5d2: The command palette (⌘K) now searches inside modules. The kernel serves `GET /api/v1/search`
  from search providers that modules register with `ctx.search.addProvider`; it asks only the
  modules a person can open, and each provider keeps to what that person may see. Work answers
  with issues by key (type `PLT-14`) and by keyword, each with its status and assignee, under an
  "Issues" group and scope. No configuration or schema change.
- 158db6a: Fixes found by the end-to-end Work flows. Page loads no longer count against the strict
  ten-a-minute limit for sign-in and setup, which locked everyone behind one office address out
  with "Too many requests". Mentioning someone in an issue description now notifies them, as a
  mention in a comment does. On the board, a card moved twice in a row is judged by the
  transitions of its current status, a card dropped with the keyboard keeps the focus, a card
  dropped on a column's refusal note says why it stays, quick moves no longer jump back while
  the server catches up, and a link to a project you cannot see says so instead of inviting you
  to create one. Realtime updates refetch only what changed, and an issue's activity now reads
  "created the issue" rather than "changed created". No configuration or schema change.
- Updated dependencies [51cd3ae]
- Updated dependencies [e2aa5d2]
- Updated dependencies [2e14b26]
- Updated dependencies [72bd7b9]
- Updated dependencies [4d5e58f]
  - @bemmoly/shared@0.2.0
  - @bemmoly/ui@0.2.0

## 0.1.7

### Patch Changes

- @bemmoly/shared@0.1.7
  - @bemmoly/ui@0.1.7

## 0.1.6

### Patch Changes

- a13da15: Fix people behind one shared address (an office network) being locked out with "This page did not load". The web app reads the setup status on every page load, and that read counted against the strict sign-in limit of ten requests a minute per address. It now counts against the ordinary per-person budget; creating the first admin stays strictly limited.
- @bemmoly/shared@0.1.6
  - @bemmoly/ui@0.1.6

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
  - @bemmoly/ui@0.1.5

## 0.1.4

### Patch Changes

- b98d0c0: Settings › Updates has a "Check for updates" button that fetches the release list right away instead of waiting for the daily check, and the page says plainly when the list has never been fetched or the last check failed, rather than claiming you are on the latest release.
- @bemmoly/shared@0.1.4
  - @bemmoly/ui@0.1.4

## 0.1.3

### Patch Changes

- Updated dependencies [04c4f3a]
  - @bemmoly/ui@0.1.3
  - @bemmoly/shared@0.1.3

## 0.1.2

### Patch Changes

- 8337385: People you invite join as Viewer, the least-privileged role, unless you pick another role:
  in the setup wizard, in Users › Invite people, for a new team's default role and through the
  API, where `roleId` is now optional on `POST /api/v1/invitations`. Invited people now appear
  in Users as INVITED rows and count as invited, with Resend, Copy invite link and Revoke.
  After sending invitations, Bemmoly shows each person's sign-up link to copy and share, and
  says so plainly when outbound email is not set up yet; Copy invite link issues a fresh link
  later (the old one stops working). Invitation and password reset emails now link to pages
  that exist (`/accept-invitation` and `/reset-password`); links sent by earlier versions open
  a missing page, so resend those invitations or copy a new link. No configuration or schema
  change.
- 8337385: Fresh installs start with no module enabled. A module runs only once an admin enables it in
  Settings › Modules (or lists it in `BEMMOLY_MODULES`, which still pins the set). Enabling a
  module now asks "Who can use it?": Nobody yet (recommended; only org admins can open it),
  Everyone, or Specific teams. Nothing is granted that the admin did not choose; the access a
  module suggests is shown as a hint only. Access can be changed later under Users › Module
  access, and the audit log records the access chosen on enable. `bemmoly-db modules enable`
  takes `--access none|everyone|teams` and `--team <id>`, and defaults to none. The Sample
  module is a developer example: it stays in the image but is off until enabled and suggests no
  access. Existing installs keep the modules and grants they have; to turn Sample off, use
  Disable in Settings › Modules. No configuration or schema change.
- Updated dependencies [8337385]
- Updated dependencies [8337385]
- Updated dependencies [3fb2621]
  - @bemmoly/shared@0.1.2
  - @bemmoly/ui@0.1.2

## 0.1.1

### Patch Changes

- a2b7f81: Run changelog backfills through the tagged query path: the table stays a checked, quoted identifier and the cursor and batch size travel as parameters.
- Updated dependencies [e231a13]
- Updated dependencies [94c57cc]
  - @bemmoly/ui@0.1.1
  - @bemmoly/shared@0.1.1

## 0.1.0

### Minor Changes

- b403d58: Add email and in-app notifications. Every email goes through an outbox that retries with
  backoff and shows failures in plain words to admins; SMTP and a development `log` provider
  are built in, with a test send that checks SPF and DMARC. Emails are themed from the
  workspace brand colour and logo, say why they were sent, and carry a one-click unsubscribe
  link. Notifications land in the inbox and follow each person's preference per kind: email at
  once, a digest every few minutes or once a day, in-app only, or off.

  Schema: changesets `0200-email-outbox`, `0201-notifications` and
  `0202-notification-preferences` add `email_outbox`, `notifications`,
  `notification_preferences` and `notification_schedules`. Settings: `email.provider`
  (default `log`), `email.smtp.host`, `email.smtp.port`, `email.smtp.security`,
  `email.smtp.username`, `email.smtp.password` (secret), `email.from`, `email.replyTo`,
  `email.digestMinutes`.

- c7e5a48: Settings are now guarded by the capability that owns them. Anyone holding a
  `workspace.*.manage` capability can read the settings list, and saving a key needs the
  capability for its group: `appearance.*` needs "Set appearance and themes"
  (`workspace.appearance.manage`), `email.*` needs `workspace.email.manage`, `system.*` needs
  `workspace.system.manage`, and every other workspace key needs `workspace.settings.manage`.
  People who were given only the appearance capability can now save the workspace look.
  Behaviour change: holding only `workspace.settings.manage` no longer lets someone change email
  or system settings; give them the email or system capability as well.

### Patch Changes

- 293b01b: The audit log now records settings, modules and backups, as Settings › Audit log says it does:
  `setting.updated` and `setting.reset` with the value before and after (secrets only as set or
  not set), `module.enabled`, `module.disabled` and `module.data_removed` with the module's state
  and the changesets reversed, and `backup.started`, `backup.verified`, `backup.restored` and
  `backup.restore_failed`. Each row is written in the same transaction as the change; a restore's
  row is written into the restored database once it finishes. A save that leaves a setting as it
  was writes no row.
- Updated dependencies [b403d58]
  - @bemmoly/shared@0.1.0
  - @bemmoly/ui@0.1.0
