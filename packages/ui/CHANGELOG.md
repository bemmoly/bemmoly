# @bemmoly/ui

## 0.1.2

### Patch Changes

- 3fb2621: Every dropdown is now the same control, whether it holds three options or three hundred. The
  arrow on each dropdown is darker so you can see it, the list opens in a popover that is never
  cut off by a table or a panel, and it works from the keyboard. Long lists show the first 50
  with a search box; people pickers (team lead, module access, the audit log's actor) search the
  whole workspace on the server as you type, and role and team pickers can be searched too. The
  "···" menu on a user row in Settings › Users now opens where you can see it.

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

## 0.1.0

No changes in this release.
