# ADR 0031: Org templates are managed in Settings › Docs; built-ins read only

- Status: accepted
- Date: 2026-10-11
- Changes: the template rules in `modules/docs/server/src/services/templates/` and
  `modules/docs/changelog/0012-docs-default-templates.ts` ("built-ins are never deleted, only
  edited"; org templates written under `workspace.settings.manage`)
- Evidence: owner request for a Settings › Docs page; interaction notes in
  [`docs/design/premium/interaction/settings-docs.md`](../design/premium/interaction/settings-docs.md)

## Context

The Docs module stores org-wide templates (`templates.space_id` null) beside each space's own,
and seeds six built-ins with a stable key. The server let anyone with
`workspace.settings.manage` change an org template, but no endpoint could create one (a new
template needed a space), nothing could hide one without deleting it, the picker's order could
not be set, and no screen managed any of it. A built-in could be rewritten in place, so an
install's "RFC" could silently stop being the RFC the release notes describe, and a later release
could never improve it.

## Decision

1. **A capability of its own.** `docs.templates.manage` ("Manage org templates", group Docs),
   on for org admins and off for every other role by default, gates every write to an org-wide
   template and the Settings › Docs list. A space's templates stay under `docs.space.configure`
   for that space. Refusals are `ForbiddenError` (403).
2. **Settings › Docs is where they are managed.** `GET /api/v1/docs/org-templates` lists the
   org templates with the archived ones, how many pages each started and who added it.
   `POST /api/v1/docs/templates` takes `spaceId: null` for an org template.
   `POST …/templates/:id/archive`, `…/restore` and `…/duplicate` and
   `PUT /api/v1/docs/org-templates/order` (every active org template, once) complete it. The
   page is the Docs module's own settings (ADR 0030): the manifest declares
   `settings: { path: '/settings/docs', requires: 'docs.templates.manage' }` and
   `web/src/settings.tsx` draws it, so the row under Settings › Modules shows only to the people
   the capability admits.
3. **Archive, not delete.** Archiving sets `archived_at`: the template leaves every picker, cannot
   start a page (404) and stays readable only to its managers. Restore clears it. Both are
   reversible, so the screen offers Undo and never confirms. Delete stays for custom templates
   but the screen does not offer it.
4. **Built-ins read only.** `PATCH` and `DELETE` on a built-in answer 409. A built-in can be
   ordered, archived, restored and duplicated; the copy is an ordinary, editable template placed
   right after it. Edits an install made to a built-in before this release are kept as they are.
5. **No new table or column.** `archived_at`, `position` and `created_by` already exist on
   `templates`; no changeset is needed.

## Consequences

- Org admins can add, edit, order, hide and restore org templates without touching a space, and
  can give that right to another role in Roles.
- A built-in can no longer be tuned in place; duplicating it and archiving the original is the
  way to own one.
- Org template changes publish no realtime event (there is no scope every Docs screen
  subscribes to); pickers read the list when they open.

## Alternatives

- **Keep `workspace.settings.manage`.** Rejected: it covers the whole workspace's settings; a
  Docs lead should be able to curate templates without them.
- **Let built-ins be edited, with a "Reset to default".** Rejected for now: it needs a stored
  original per release and a diff to explain what reset would change; duplicate and archive
  give the same result with what exists.
- **A dialog for the editor.** Rejected: a template's body is a document; see the interaction
  notes.
