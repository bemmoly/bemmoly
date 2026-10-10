# @bemmoly/shared

## 0.4.1

No changes in this release.

## 0.4.0

### Minor Changes

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

## 0.3.0

No changes in this release.

## 0.2.2

No changes in this release.

## 0.2.1

No changes in this release.

## 0.2.0

### Minor Changes

- 51cd3ae: Add the Bemmoly Query Language (LQL) parser that the Work module's filter bar, swimlane
  queries, saved filters and automation conditions share. A query such as
  `project = PLT AND status != Done AND assignee = me AND "spec doc" IS EMPTY ORDER BY updated DESC`
  is parsed into a syntax tree, checked against the issue fields (project, key, type, status,
  status category, priority, assignee, reporter, parent, epic, sprint, estimate, due, created,
  updated, fix version, label, text and `cf.<key>` for custom fields), and printed back in a
  canonical form so saved filters are stored one way. Mistakes come back with the exact position
  and what was expected, so the filter bar can underline them, and autocomplete offers the
  fields, operators, keywords and values that fit where the cursor is. Compiling a query to SQL
  lives in the Work module, not here. No configuration or schema change.

### Patch Changes

- e2aa5d2: The command palette (⌘K) now searches inside modules. The kernel serves `GET /api/v1/search`
  from search providers that modules register with `ctx.search.addProvider`; it asks only the
  modules a person can open, and each provider keeps to what that person may see. Work answers
  with issues by key (type `PLT-14`) and by keyword, each with its status and assignee, under an
  "Issues" group and scope. No configuration or schema change.

## 0.1.7

No changes in this release.

## 0.1.6

No changes in this release.

## 0.1.5

No changes in this release.

## 0.1.4

No changes in this release.

## 0.1.3

No changes in this release.

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

## 0.1.1

No changes in this release.

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
