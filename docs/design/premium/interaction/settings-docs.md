# Settings › Docs

## Org templates (`/settings/docs`)

- **Primary job.** Decide which templates every space's template picker offers, in what order.
- **Who.** People with `docs.templates.manage` ("Manage org templates" in Roles, org admins by
  default). The server refuses everyone else with 403; the row under Settings › Modules shows
  only to the people the capability admits (the module declares it in its manifest, ADR 0029).
  Spaces keep their own templates; a line under the title says so and they never show here.
- **Layout.** `contained`. The title and its sentence, a search box beside an Active · Archived
  `SegmentedControl`, then the one `Table`: grip, name (icon, name, Built-in badge,
  description), category, fields, used, created, and the row's ··· menu. Phones keep the name
  and the menu.
- **Top three actions.**
  1. **New template**: the header's primary button, or ⌘K "New template". Opens the focused
     editor in place (`?template=new`).
  2. **Preview, then edit**: a row (click, or ↑↓ and Enter) opens its read view
     (`?template=<id>`): name, description, category, the fields the page form asks for and the
     body as a page would show it. Edit there (or in the row menu) turns it into the editor
     (`&edit=1`). A built-in has no Edit; it offers Duplicate to edit, which makes an editable
     copy right after it and opens the copy's editor.
  3. **Archive with Undo**: the row menu, or the read view. The row leaves Active at once with an
     Undo toast; Archived lists it with Restore (also with Undo). An archived template is gone
     from every picker and cannot start a page.
- **Reorder.** Drag a row by its grip, or focus the grip and press ↑ or ↓. Only in Active and
  only while the search box is empty, since a filtered list has no whole order to save. The
  order is the picker's order; it is saved at once and rolls back with a toast if refused.
- **Editor.** Name, category (typed; it groups the picker), description, icon (the page icon
  picker), the fields the new page's form asks for (label, kind, choices for a choice), and the
  body in the Docs editor, inside the template's settings section with Cancel and Save at its
  foot (read-then-edit). Mod+Enter saves from any field. Cancel with changes discards them at
  once with an Undo toast that brings the draft back.
- **Keys.** ↑↓ or J K move through rows, Enter opens the read view; on a grip ↑↓ move the row;
  Esc leaves the editor or the read view for the list (and from the list, settings for the app);
  Mod+Enter saves the editor. No new single-letter keys.
- **States.** Loading: a table skeleton under the real title and controls. Empty Active: "No
  org templates" with New template. Empty Archived: "Nothing archived". A search with no match:
  "No templates match" with Clear search. Error: what failed and Try again. Many: the table
  grows with the column; search narrows it. No permission: the server's 403 shows "Only people
  who manage org templates can change these" with no actions. Phone: the table keeps name and
  menu; the editor's fields stack.
- **URL state.** `?q=` search, `?view=archived`, `?template=<id>` the read view (`new` for the
  editor of a new one), `&edit=1` the editor. Back and Forward walk them; reload restores them.

### Choices recorded

- **Built-ins read only.** Until now an admin could rewrite a built-in in place. Settings ›
  Docs makes them read only (hide by archiving, or duplicate to edit), so the six stay what the
  release notes describe and an upgrade can improve them. ADR 0030.
- **The editor is the settings page in another state, not a dialog.** A template's body is a
  document; a dialog would squeeze the editor and nest its popovers inside a focus trap. The
  page swaps the table for the editor in the same reading column, with the trail ending in the
  template's name, as the issue page refines its trail.
- **Archive, not delete.** The page never deletes. Archive is reversible and keeps pages that
  were made from the template pointing at it, so Undo is enough and no confirmation is needed.
- **Org templates do not push realtime events.** A space's template events are scoped to the
  space; there is no scope every Docs screen listens to. Pickers read the list when they open.
