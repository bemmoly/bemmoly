# @bemmoly/web

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
