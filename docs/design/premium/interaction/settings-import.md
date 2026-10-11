# Settings › Import and the setup wizard's import step

How an admin brings projects, issues, spaces and pages in from another tool. The page lives in
the settings frame (`contained`), in the Modules group under Manage modules; the wizard step is
the same flow inside the standalone setup screen. Other products' names appear only as source
labels ([`../../system/content.md`](../../system/content.md)). Nothing here is AI output, so
nothing is lilac.

## Settings › Import

**Primary job.** Move one tool's data in, see exactly what will happen before it does, and read
what happened afterwards.

**Shape.** One reading column. The body is one step at a time, then Recent imports below it.

1. **Choose a source.** Option cards (`SelectableCard` through the wizard's `ChoiceCard`) for the
   sources the enabled modules offer: Jira and CSV file from Work, Confluence from Docs. Each
   card shows a design-system icon (the neutral `import` icon for Jira and Confluence, never
   their logos), the name and what it brings.
2. **Connect.** A section drawn from the source's field list: URLs in mono, a `Select` for
   choices, a native file picker for CSV, secrets as password fields with "Stored encrypted;
   never shown again." under them. Fields with `showWhen` appear only while the other field
   holds a listed value (email only for Cloud). Connect stays disabled until every visible
   required field has a value. "Other sources" goes back.
3. **What to bring in.** The site, the totals found ("Found 3 projects · 2,769 issues · 24
   users."), the source's warnings as caution notices, then a checklist of projects, spaces or
   the file with their record counts, all ticked. "Preview plan" asks for the plan.
4. **Plan.** Mapping rows grouped by kind (Status, Person, Field): source, arrow, target, and a
   state pill: Matched (green), Created (accent), Reported only (amber). Changing the ticks
   marks the plan out of date and disables Start until it is previewed again.
5. **Importing.** A pill, the phase and "done of total" (live region), a progress bar in the
   accent, and Cancel import. The job is read every second while queued or running.
6. **Report.** Created, updated and skipped per kind in a small table; the first skipped records
   with their reason and "and N more"; warnings; the job's error as a caution notice. "Run
   again" after a finished import (it updates what the import made rather than adding copies),
   "Resume" after a failed or cancelled one, and "New import".

**Recent imports.** The latest jobs: source, site, when, state. Opening one shows it at its own
step (plan, progress or report).

**Top three actions.**

1. Pick a source: Tab into the radio group, arrows move, Enter or Space picks.
2. Connect: Enter in any field submits the form.
3. Start import, then Run again or Resume: plain buttons, reached in reading order.

**Keyboard map.** No single-letter keys. Esc leaves settings, as the shell does. Every key is
the shared components' own.

**States.**

- Loading: three card skeletons and a panel skeleton (`ImportSkeleton`).
- No sources (no module with an importer is on): an empty state, "No import sources yet" /
  "Turn on Work to import from Jira or a CSV file, or Docs to import from Confluence." /
  "Manage modules".
- Connection refused or unreachable: the server's own words in the form's alert, under the
  fields, with the request id; the typed values stay.
- File over 10 MB: refused before reading, under the file field, with the size and the limit.
- Failed load: the settings failure with Retry.
- No permission: the page is not in the sidebar for non-admins; the route sends them elsewhere.
- Phone (390px): cards stack, mapping rows wrap the target and pill under the source, the
  report table keeps four narrow columns, buttons wrap to the right.

**URL state.** None in this release: the open job lives in page state, and Recent imports
reopens it after a reload.

## Setup wizard: Import step

The same cards and the same flow (`ImportFlowBody`) beside a Start clean card, which is picked
until another card is. Picking a source opens its connection form under the cards; the run
keeps going while setup continues, and its report waits in Settings › Import.

During setup the modules may not be on yet. When the server offers no source (or the list
cannot be read), the three importers stay visible but not pickable, each with a badge naming
what it needs ("Needs Work", "Needs Docs"), and the line under the cards says "Importers run
once Work or Docs is turned on. Continue for now, then import from Settings › Import." Continue
always moves on; Skip for now leaves the step unanswered.
