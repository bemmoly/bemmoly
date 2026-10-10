# Workspace settings

Covers every workspace settings page: Profile, Notifications, General, Appearance, Email delivery,
AI and models, Members, Teams, Roles, Sign-in and SSO, Modules, Storage and backups, Updates,
System status and Audit log. The frame, sidebar and header belong to the shell; this file is about
the content beneath the header.

## Shared behaviour

- **Primary job.** Read the current setup at a glance; change one thing without leaving the page.
- **Layout.** `contained` reading column. Sections sit on raised cards; lists of things are the one
  quiet table, never cards in cards.
- **Read, then edit.** A section shows its values with an Edit button. Edit swaps in fields in place;
  Save and Discard sit in the section (or in the header when the whole page is one form, as on
  Notifications, Appearance, AI and Roles). Save shows progress and cannot double-submit; a failure
  keeps the typed values and says what to do next.
- **Undo over confirm.** Reversible changes (role changes, removing someone from a team, disabling a
  module) apply at once with an Undo toast. Irreversible ones (removing a module's data, restoring a
  backup, deleting a team) use the typed confirmation.
- **States.** Loading is a skeleton shaped like the page's sections. Errors show what failed and a
  Retry. Empty tables say what fills them and offer the action that does. No permission hides the
  edit controls and says who can change it.
- **Status visuals.** Sentence-case pills with a status circle: grey (off, not set), blue (in
  progress), green (healthy), amber (needs attention), red only for failures.
- **Keyboard.** Tab order follows reading order; Esc leaves an edit (and, from settings, goes back to
  the app); Enter in a single-field edit saves.
- **Phone (under 640px).** Tables keep the columns that identify the row and its main action
  (`hideOnPhone` for the rest); long values truncate rather than overlap; two- and three-column card
  grids stack; settings rows wrap so the control drops under its label.

## Page notes

- **Profile.** Who you are signed in as; links to Notifications and the personal theme menu.
- **Notifications.** One row per event with a delivery select; the digest cadence below.
- **General.** Workspace name, URL (set by the server, shown read-only with where it comes from),
  language and timezone.
- **Appearance.** Theme presets with a live BrandBlock preview. The logo row explains that "on
  Bemmoly" and the mark stay with a custom logo; custom themes never recolour the mark.
- **Email delivery.** Transport, sender and digests, a test send, and the outbox with failures named.
- **AI and models.** Works without AI; popular providers as tiles, the full catalog searchable.
- **Members.** Search, status segments, role and team filters, a quiet role menu per row, invite in
  the header.
- **Teams.** Table with lead, facepile, module access and default role.
- **Roles.** Capability matrix per org role; locked rows show why.
- **Sign-in and SSO.** Method cards with their state, then sign-in policies.
- **Modules.** Table with tile, state, version, schema state; Enable is primary, Remove data is a
  separate confirmed step. On phones the Enable or Disable button carries the state.
- **Storage and backups.** Last good backup up top, one-disk and secret-key warnings, schedule,
  retention, destinations, encryption, then the backups table (scrolls inside its card on phones).
- **Updates.** Current version, channel, checks and the air-gapped bundle upload.
- **System status.** Health checks and server facts, each with a link to where to fix it.
- **Audit log.** Filterable table (action, actor, target, date range) with RelativeTime and
  Export CSV. On phones it keeps When and Action.
