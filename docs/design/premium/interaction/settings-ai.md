# Settings › AI and the setup wizard's AI step

How an admin turns AI on, connects providers, assigns models to roles and decides what AI may
see, spend and say. The page lives in the settings frame (`contained`); the wizard step is the
standalone setup screen. The rules are [`../../system/ai.md`](../../system/ai.md): nothing on
these admin pages is AI output, so none of it is lilac. Lilac stays for what models produce.

## Settings › AI and models

**Primary job.** Decide whether this workspace uses AI and, if it does, which models do what,
with what data and at what cost, without leaving the page.

**Shape.** The header carries four section tabs while AI is on: Setup (`/settings/ai`), Privacy
(`/settings/ai/privacy`), Usage (`/settings/ai/usage`) and Prompts (`/settings/ai/prompts`).
Each is one reading column of sections (`SettingsSection`), never cards in cards.

- **Setup.** First, one row that answers "is AI on": a `Switch` and the line under it ("Every AI
  surface is hidden for everyone" when off). Then Providers (a table: logo, name, what it is,
  last test, Test and ··· per row; "Add provider…" in the section header), Model roles (fast,
  standard, strong, embedding: a `Select` per role listing eligible models across every
  connected provider, grouped by provider, the suggested default marked; the chosen model's
  capability badges, context size, price per million tokens and release date under it), and
  Catalog (the status line, "Fetch the catalog live" switch, "Upload catalog file…").
- **Privacy.** Send content, redact email addresses, redact names, excluded spaces and
  projects, let AI actions change data, allow people to turn AI off for themselves. Switches
  apply at once with an Undo toast; exclusions are chips with Remove and an "Add…" menu.
- **Usage.** The monthly budget (read view with Edit; a USD amount, empty means no limit), a
  meter of this month's spend against it, then three tables: by role, by purpose and by model.
- **Prompts.** A read-only table of prompts (name, role, version, "Changed" when overridden).
  Opening one shows the default beside the override editor; "Show changes" draws a line diff;
  "Save override" and "Reset to default" (with Undo).

**Adding a provider.** A `Modal` (lg; a sheet on phones) in two steps. Pick: the Popular row
(the catalog's own names and logos, then Local server), then the whole catalog, searchable,
sorted by name, with the catalog status line. Connect: the form generated from the catalog
entry's env list (each key a password field that is write-only: once stored it reads "Stored ·
Replace"), the base URL pre-filled and editable, the provider's documentation link. Local
server asks for a protocol, a base URL and an optional key. "Test connection" reports in plain
words, quoting the provider's own error; a passing test lists the models found. "Connect
provider" saves.

**Top three actions.**

1. Turn AI on or off: the first switch on Setup. Tab reaches it first; Space toggles.
2. Add a provider: "Add provider…" (mouse, Tab then Enter, touch). In the dialog the search
   box takes focus; Tab reaches the list; Enter picks; Enter in a field connects.
3. Assign a model to a role: each role's `Select` (Enter or Space opens, typing searches, Enter
   picks). The change saves at once with Undo.

**Keyboard map.** No single-letter keys (the page is mostly fields). Esc closes the dialog, then
leaves settings, as the shell does. Enter in a field submits the provider and budget forms; Mod+Enter saves a prompt override. Every key
is the shared components' own.

**States.**

- Loading: skeletons shaped like the sections (status row, a three-row table, four role rows).
- Never set up (AI off, no provider): the status row plus one empty state, "AI is off" / "Connect
  a provider to turn on summaries, planning help and answers about your docs. Bemmoly works
  fully without it." / "Add provider…". Only admins reach this page, so only admins see it.
- AI off with providers kept: the status row only; tabs hide; a line says the providers and
  roles are kept for when it is turned back on.
- Provider down: its row shows a red status with the provider's error and Try again; roles that
  use it say "Paused: <provider> isn't answering" under their select. The page stays usable.
- Catalog offline: the status line says "Offline · …"; uploads and the bundled list still work.
- Budget at 80%: an amber notice; at 100%: a red notice that standard and strong are paused
  until the 1st or until the limit is raised; the fast role and embeddings keep working.
- Errors: a failed load is the settings failure with Retry; a failed save keeps the typed values
  and says what to do next in a toast with Retry.
- Many items: the catalog list scrolls inside the dialog; the model select searches past 50.
- No permission: the page is not in the sidebar without `ai.models.configure`; the route sends
  people elsewhere.
- Phone: tables keep name and status; selects take the full width; the dialog is a sheet.

**URL state.** The section tab is the path. The provider dialog is `?add=1` (and
`?add=<catalog id>` once one is picked), so reload and Back keep it. The open prompt is
`/settings/ai/prompts?prompt=<id>`.

## Setup wizard: AI step

Same parts as Settings: "No AI for now" and Local server first, the Popular row, the full
searchable catalog, then the generated connection form with Test connection, then the four role
pickers with the suggested defaults pre-selected, then the privacy rows. "Skip, no AI" is the
footer's skip and is as prominent as the primary. Nothing is sent to a provider until Test
connection or Save.

## Personal opt-out

Profile shows "Use AI features" only when AI is on and the admin allows opting out. Turning it
off hides every AI surface for that person at once and keeps their own writing out of
summaries others ask for, except titles.

## Choices recorded

- Section tabs instead of one long page: the review draws AI and models as one card stack, but
  with budget, usage and prompts it would run past five screens. Tabs are the header's own
  "settings area's sections" (layout.md).
- Role changes and privacy switches apply at once with Undo rather than through a page-wide
  Save, as interaction rule 3 asks; the budget amount keeps read-then-edit because a typed
  number is not a toggle.
- Provider logos are the catalog's monochrome files painted in `tx`, so no vendor colour
  appears.
