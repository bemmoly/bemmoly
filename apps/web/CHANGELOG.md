# @bemmoly/web

## 0.1.7

### Patch Changes

- @bemmoly/api-client@0.1.7
  - @bemmoly/core-web@0.1.7
  - @bemmoly/shared@0.1.7
  - @bemmoly/ui@0.1.7

## 0.1.6

### Patch Changes

- @bemmoly/api-client@0.1.6
  - @bemmoly/core-web@0.1.6
  - @bemmoly/shared@0.1.6
  - @bemmoly/ui@0.1.6

## 0.1.5

### Patch Changes

- Updated dependencies [0278663]
  - @bemmoly/core-web@0.1.5
  - @bemmoly/api-client@0.1.5
  - @bemmoly/shared@0.1.5
  - @bemmoly/ui@0.1.5

## 0.1.4

### Patch Changes

- b98d0c0: Settings › Updates has a "Check for updates" button that fetches the release list right away instead of waiting for the daily check, and the page says plainly when the list has never been fetched or the last check failed, rather than claiming you are on the latest release.
- Updated dependencies [b98d0c0]
  - @bemmoly/api-client@0.1.4
  - @bemmoly/core-web@0.1.4
  - @bemmoly/shared@0.1.4
  - @bemmoly/ui@0.1.4

## 0.1.3

### Patch Changes

- 04c4f3a: Settings pages no longer let a stray click change something. Storage and backups, Updates, Email
  and notifications and Workspace details open showing your current values; each section has an
  Edit button, and Save stays off until you change something. Changes that can lose backups or
  stop people working (lowering retention, removing the backup bucket, turning off local
  encryption, switching the update channel, sending email to the dev mailbox) say what will happen
  before they are saved, and the riskiest ask you to type a word to confirm. If you leave a page or
  have two sections open with unsaved changes, a bar at the bottom says so.

  Restoring a backup is easier to find: every backup that can be restored has a Restore button, a
  Restore… button at the top of Storage and backups lets you pick one, and the confirmation explains
  maintenance mode, what is replaced and the fallback copy kept of your current data. The backups
  table scrolls sideways on narrow screens instead of cutting off its buttons.

  The top bar no longer shows arrows on links that do not open a menu. Create opens a clear menu of
  what you can make, or explains that it fills once a module is enabled, with a link to Settings ›
  Modules for admins. Icons across the app are clearer, including real Inbox and theme icons in the
  top bar, and dropdown arrows are larger and darken while open. The Team filter in Settings › Users
  can be searched, and abandoned people searches stop instead of finishing in the background.

- Updated dependencies [04c4f3a]
  - @bemmoly/ui@0.1.3
  - @bemmoly/api-client@0.1.3
  - @bemmoly/core-web@0.1.3
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
- 3fb2621: Every dropdown is now the same control, whether it holds three options or three hundred. The
  arrow on each dropdown is darker so you can see it, the list opens in a popover that is never
  cut off by a table or a panel, and it works from the keyboard. Long lists show the first 50
  with a search box; people pickers (team lead, module access, the audit log's actor) search the
  whole workspace on the server as you type, and role and team pickers can be searched too. The
  "···" menu on a user row in Settings › Users now opens where you can see it.
- 42a4218: The setup wizard's appearance step builds a custom theme in place: "Build a custom theme with
  your brand color instead" opens the brand colour, light or dark, surfaces and typeface controls
  under the preset tiles, the whole page previews the result as you edit, and Finish setup saves
  it. Before, the link left the wizard and sent you back to the import step. An admin who opens
  another page before finishing setup now returns to the step they were on.

  Logos on the setup and Settings › AI option cards are no longer greyed out: provider marks use
  the primary text colour, the Jira and Confluence marks use their brand colours (adjusted on dark
  themes so they stay readable), and "Coming soon" cards fade as a whole.

- Updated dependencies [8337385]
- Updated dependencies [8337385]
- Updated dependencies [3fb2621]
  - @bemmoly/shared@0.1.2
  - @bemmoly/api-client@0.1.2
  - @bemmoly/ui@0.1.2
  - @bemmoly/core-web@0.1.2

## 0.1.1

### Patch Changes

- e231a13: The first-run setup reads in order. Step 1 asks for the workspace (name, then its address)
  and then for your account (name, email, password), one field per row, in two labelled groups.
  The address is filled in from the browser and shown as a value to check. On the People step
  the email invites have a proper heading that says new people join as Members with no team,
  and the Done summary leaves skipped steps unticked. The note beside the steps now only says
  that everything can be changed later in Workspace settings. No configuration or schema change.
- 94c57cc: The first-run setup wizard shows real logos on its option cards: each AI provider in the
  bundled catalog, the import sources and the single sign-on options, all drawn in the current
  text colour so they follow the theme. Importers and single sign-on are marked "Coming soon"
  instead of looking broken; on the import step "Start clean" is picked from the start, so
  Continue moves on without skipping. Settings › AI uses the same provider logos.
- 54faa51: Before a workspace has a look of its own (the setup wizard, the sign-in page), Bemmoly now
  opens in the Classic light theme instead of following the computer's dark mode. Once setup
  saves a theme, everyone sees it, and members can still pick light or dark for themselves when
  the workspace allows it.
- f4fe47e: Picking a theme in the setup wizard's Appearance step, or in Settings › Appearance, now
  re-themes the whole page at once, so you can see it before saving. Saving keeps it for the
  workspace; skipping the step, discarding, or leaving the page returns to the saved look.
- Updated dependencies [e231a13]
- Updated dependencies [94c57cc]
  - @bemmoly/ui@0.1.1
  - @bemmoly/api-client@0.1.1
  - @bemmoly/core-web@0.1.1
  - @bemmoly/shared@0.1.1

## 0.1.0

### Minor Changes

- c7e5a48: Settings are now guarded by the capability that owns them. Anyone holding a
  `workspace.*.manage` capability can read the settings list, and saving a key needs the
  capability for its group: `appearance.*` needs "Set appearance and themes"
  (`workspace.appearance.manage`), `email.*` needs `workspace.email.manage`, `system.*` needs
  `workspace.system.manage`, and every other workspace key needs `workspace.settings.manage`.
  People who were given only the appearance capability can now save the workspace look.
  Behaviour change: holding only `workspace.settings.manage` no longer lets someone change email
  or system settings; give them the email or system capability as well.

### Patch Changes

- e61b7a9: The web app paints its top bar and logo as soon as the stylesheet arrives, before its
  JavaScript runs or the first API call returns, so a cold load on a phone shows the frame in
  under a second instead of a blank page. The app's code still downloads from the start, at low
  priority, and replaces the frame in a single step once the first page is ready.
- Updated dependencies [b403d58]
  - @bemmoly/shared@0.1.0
  - @bemmoly/api-client@0.1.0
  - @bemmoly/core-web@0.1.0
  - @bemmoly/ui@0.1.0
