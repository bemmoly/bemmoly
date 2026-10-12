# Settings › Import and the setup wizard's import step

How an admin brings projects, issues, spaces and pages in from another tool. The page lives in
the settings frame (`contained`), in the Modules group under Manage modules; the wizard step is
the same flow inside the standalone setup screen. Other products' names appear only as source
labels, as plain words beside the neutral `import` icon, never a logo or their colours
([`../../system/content.md`](../../system/content.md)). Nothing here is AI output, so nothing
is lilac.

The approved design is the importer review (`docs/design-review/import-source/`, outside the
repository: `chooser.js` for the chooser's exact behaviour, `screens.js` and `content.js` for
every step). Build state per step is marked **Built**, **Interim** or **Planned**.

## Primary job

Move one tool's data in: choose exactly what to bring, see what will happen before it does,
and read what happened afterwards.

## Top three actions

1. **Choose what to bring** (Choose): click a row, Shift-click a range, the header box for all
   shown; keyboard: Down from search into the list, Space, Shift+Space, Mod+A; touch: tap rows
   (60px tall on a phone).
2. **Continue with N**, then **Start import**: plain primary buttons at the end of their step,
   reached in reading order; Enter or Space on them.
3. **Undo a clear**: the Undo toast for six seconds, or Mod+Z while it shows.

## The steps

A stepper above the flow: Connect, Choose, Options, Review, Import. A step behind is a button
back to it while the import has not started (Choose back to Connect keeps the typed form;
Options back to Choose keeps the selection; Review back to Options keeps every choice, since the
plan holds them); a step ahead is plain text. On a phone only the
current step keeps its name; the others are numbered circles with their names for screen
readers.

1. **Source.** Option cards for the sources the enabled modules offer (Jira and CSV file from
   Work, Confluence from Docs). **Built** (unchanged).
2. **Connect.** **Built.** Page head "Import from Jira" and "Connect with an API token. Nothing
   is read beyond the list of projects until you choose what to bring." (spaces for
   Confluence; a file line for CSV). The fields come from the source; beside Connect the note
   "Connecting lists projects only. It changes nothing." A refused token keeps every typed
   value, shows the server's words and request id in the alert, and puts the token field in
   error (`aria-invalid`) with the two usual causes under it.
3. **Choose.** **Built.** Section "Choose projects" with "acme.example.net · 14 projects this
   token can see". Then, in order:
   - Notices: a caution when some rows cannot be read ("People operations and Finance close
     can't be read with this token…", with Change connection), and on sites over 200 an
     information notice that counts load as rows come into view.
   - Search (server-side over key, name and lead, 200ms after typing; Esc clears; Down moves
     into the list) and a segmented filter: All, Not imported, Imported before, No access,
     Selected, each with its count. A filter with no rows hides, except All, Selected and the
     one chosen.
   - The header: a tri-state select all (none, some, all of the selectable rows this search
     and filter show) and the columns Key, Name, Type, Lead (projects only), Issues or Pages
     (right, tabular), Status (Imported Oct 2 with the refresh icon, Key in use, No access
     with the lock icon).
   - The rows: a virtualised listbox (`VirtualList`), 44px rows (60px stacked under 640px),
     nine in view, pages of 100 loaded as the view nears the end. A row not counted yet shows
     a skeleton bar; the rows in view (and ten below) are counted on the server a beat after
     they settle, at most 100 at a time. A row the token cannot read is locked
     (`aria-disabled`), never ticked.
   - The bar: "12 projects · ~23,410 issues (3 still counting)" (polite live region), Clear
     (ghost, acts at once, Undo), Back to Connect, "Continue with N" (primary, disabled at 0).
4. **Options.** **Built.** Continue plans what is ticked (PATCH with an empty body); every
   change after that is a PATCH that answers with the new plan. In order:
   - **What to bring** ("For all 9 projects"): a locked ticked box for the records ("Issues —
     Always; fields, keys, parents and subtasks", or "Pages and page trees"), then one checkbox
     per option the source sends (`source.options`, with its default). A tick is sent at once
     (`include`); the box shows it while the plan answers. Change history appears only when
     the server offers it.
   - **Where each project goes** ("Jira project to Work project"): the rows that want a look
     (filter `attention`: an error, an existing target, an update, a new key) come first and
     keep their place while they are fixed; "Show N more projects, all new with their own
     key" opens the rest (filter `selected`, pages of 100). A row: key, name, "6,220 issues ·
     service project" (or "· imported Oct 2"), an arrow, then the target. Imported before: a
     neutral chip "Updates Platform (PLT)". Otherwise a segmented New project | Existing. New
     shows the key field (mono, capitals and digits only, at most 10): a key that breaks the
     rule shows "Use 2 to 10 capitals or digits" at once; a valid one is sent 300ms after the
     last keystroke and the server's answer comes back on the row. Existing shows a searchable
     picker of the Work projects (Docs spaces for Confluence). Under the row, the server's
     `target.error` in red (field `aria-invalid`, described by it) or its `target.note` ("The
     key becomes SUPD.", "Its issues are numbered on from the last SUP key."). The web never
     writes its own reason.
   - **People** ("86 found across the chosen projects"): three numbers (Match a member by
     email, Become placeholders, Email hidden by Jira), the placeholder sentence, the first
     three people who may need a hand (hidden, then placeholders), each with a picker
     (Placeholder, or search members); "Review all 86 people" opens the paged list. A choice is
     sent at once (`people`) and the numbers follow. No invite.
   - **Statuses, types and fields** (Confluence: **Macros and formatting** with its note): the
     summary "3 match · 2 created · 1 reported" and "Show all N", which opens the mapping rows
     as the old plan panel drew them. People mappings are left to People.
   - The bar: Back (to Choose, selection kept) and **Review import**, disabled while the plan
     has target errors, a typed key is unchecked or invalid, an Existing row has nothing
     picked, or a change is saving. The line under it says why: "Fix the key for SUP to
     continue.", "Choose where SUP goes to continue.", "Saving your choices." (polite live
     region, and the button's description).
5. **Review.** **Built.** "Review · Nothing changes in Bemmoly until you start". A definition
   list: From (site in mono, "as" the account email), Projects ("9: 8 new, 1 into existing
   projects", and "N imported before (names) are updated, not copied"), Issues ("~15,344 with
   comments, attachments, sprints and boards and links between issues"), Not brought (the
   unticked options; left out when nothing is), People ("61 matched by email · 25
   placeholders", placeholders counting hidden), Keys ("SUP becomes SUPD", "SUP goes into
   Support Desk (SUP)"), Reported only ("1 field"). An information notice: "Large sites take a
   while. The import keeps running if you leave this page, and Inbox tells you when it is
   done." (The server posts an import_finished notification to whoever started the run.) The bar: "You can cancel at
   any time; what was brought in stays and Resume picks up from there.", Back (to Options, as
   it was) and Start import (primary, no confirm dialog). No time estimate yet: the plan has
   no rate figure to estimate from.
6. **Import (Progress).** **Built.** Section "Progress" with "3 of 12 projects" (done of chosen).
   A large overall percentage, then "8,153 of 23,410 issues · about 13 minutes left" as a
   polite live region; the minutes come from the rate this page has watched the overall count
   grow (the job's `progress` is the total across projects and only grows) and are left out
   until there is a rate. The overall bar is a progressbar named "Import progress" with its
   value. Then one row per chosen project (GET containers `filter=selected`, the first page,
   read every second while it runs): a drawn state icon (done, running, waiting, stopped; its
   word for screen readers), name and key, "Issues: 1,903 of 3,071", "Waiting" or "Done", its
   own bar (done, in progress, or red where it stopped) and n / m. Five rows show; "Show N
   more" (a disclosure with `aria-expanded`) shows the rest. The bar: "You can leave this page.
   Inbox tells you when it finishes." and Cancel import (danger, no confirm; Resume picks up).
7. **Done.** **Built.** A result alert: "All 12 projects imported. 23,373 issues, 41,902
   comments and 6,118 attachments are in Work." (ok), or when the job is
   `completed_with_errors` "11 of 12 projects imported. Mobile apps stopped partway. What it
   brought in is kept; Retry carries on from where it stopped." (caution) with "Retry Mobile
   apps" (primary; "Retry N" for several) beside it. Cancelled and failed jobs say so with
   Resume. Four tiles: Issues, Comments, Attachments, Skipped (from the report's counts; two
   across on a phone). Section "Projects": the failed ones first, "Stopped at 1,903 of 3,071:
   Jira kept answering "too many requests" for 10 minutes" with Retry (sends only that id; it
   carries on from its checkpoint), the others "1,840 issues updated · 2 skipped" with "Open
   board" or "Open space" to the path the server gives; five rows, then "Show N more". Section
   "Skipped" with "37 records": the first rows (key, reason) and "and 34 more in the list";
   its bar has "Download the list (CSV)" (a plain link to the job's `skips.csv`), New import
   and Run again (Resume when it was cancelled or failed). Run again updates what this import
   made.

**Recent imports.** The latest jobs: source, site, when, state. Opening one shows it at its
own step.

## Selection: how a tick travels

The server keeps the selection. A tick is an operation (these ids, everything this search and
filter shows, clear, restore). The chooser applies each operation to the rows it shows at once,
queues it, and sends the queue 150ms after the last tick, one request at a time so the server
applies them in order. A read of the list (a new search or filter, the next page) sends what is
waiting first and remembers which operations the server had, so only later ones are replayed on
its rows. After an operation that reaches beyond the loaded rows (all shown, clear, restore)
the list is read again. A refused request takes its ticks back and says so in a toast.
Continue sends anything waiting before it plans.

Defaults are the server's: on a site under 50, new projects with something in them start
ticked (not imported before, not locked, not personal spaces); on a bigger site nothing is.

## Keyboard map (Choose)

| Keys                     | Does                                                       |
| ------------------------ | ---------------------------------------------------------- |
| Tab                      | Search, the filters, the header box, the list, the bar     |
| Down (in search)         | Into the list                                              |
| Esc (in search)          | Clears the search (only when it holds text)                |
| Up, Down                 | Move the active row                                        |
| Home, End                | First, last row                                            |
| PageUp, PageDown         | Nine rows                                                  |
| Space                    | Tick or untick the active row                              |
| Shift+Space, Shift-click | The range from the anchor, to what the row becomes         |
| Shift+Up, Shift+Down     | Move and tick, extending                                   |
| Mod+A                    | Tick every row this search and filter shows                |
| Mod+Z                    | Undo the last clear while its toast shows                  |

No single-letter keys, so nothing collides with the global map or with typing. The filters
are a radio group (arrows move and choose).

## States

- **Loading:** six skeleton rows in the list's columns; the section and toolbar paint at once.
- **Empty (token sees nothing):** "This token can't see any projects", why (Browse projects
  permission), Change connection and Check again.
- **No match:** "No projects match “q”" with Clear search. An empty filter offers Show all.
- **Error:** the list's failure in the form alert with the request id; a refused tick puts the
  rows back with a toast; a refused plan shows under the bar.
- **Partial:** rows not counted yet carry a skeleton bar and the total reads ~ with "(k still
  counting)".
- **Many (1,240):** virtualised rows, paged in hundreds, counted on demand; the info notice.
- **No permission:** the page is not in the sidebar for non-admins; rows the token cannot read
  are locked with the caution notice.
- **Phone (390px):** rows stack (name over key, count over status), type and lead drop, the
  header shows the select-all box and its words, the filters scroll sideways inside their own
  strip, the bar wraps.

## URL state

`?job=<id>` opens that import at its own step: the Inbox notification sent when a job ends
(`import_finished`, to the admin who started it) links to `/settings/import?job=<id>`, and
opening one from Recent imports writes it, so reload and Back keep it. Picking a source, New
import and Back to Connect take it out. A job that is gone shows the failure with its request
id above the source cards. The step, search and filter stay in page state.

## Setup wizard: the short path

**Built.** Connect and Choose only, no stepper. The chooser's button reads "Start import of
N"; it plans what is ticked with the defaults (`PATCH {onClash: 'suffix'}`: a taken key takes
the next free one, listed in the report; options keep their defaults) and runs it. Then: "Importing 12 projects from Jira. It keeps
running while you finish setup; the report waits in Settings › Import." (ok alert) over a
progress bar; when it ends the line says how (finished, with a problem, stopped). The step's
own Continue moves on at any time and Skip for now leaves it; the note above them reads "Start
import runs it in the background with the default options; change them later in Settings ›
Import." The step's subtitle promises only what the importer keeps: "Import keeps keys,
comments, attachments and page trees, and running it again updates what it made instead of
copying it." (no history; it comes back only as an option when the importer reads it). Before
the modules are on, the importers stay visible but not pickable ("Needs Work", "Needs Docs").

## Choices recorded

- **Rows are listbox options, not grid rows.** The tick drawn in each row is the shared
  `Checkbox`, hidden from assistive tech and out of the tab order, so an option holds no
  interactive content; the option's `aria-selected` is the tick.
- **The header box over a filtered view.** All ticked plus a click unticks what is shown with
  Undo (the design snapshots the ticks). Over the whole list that is a clear (Undo sends
  restore); over a search or filter it unticks that scope and Undo ticks it again.
- **Status words.** "Imported Oct 2" and "Key in use" carry their explanation for screen
  readers instead of a hover title, since the system has no native titles.
- **Rows that want a look stay put.** A row the attention filter listed keeps its place at
  the top after it is fixed, so typing a key never moves the field away from the caret.
- **Existing picker source.** The kernel's `GET imports/:id/targets` lists the projects or
  spaces an import can go into; the import UI never reads a module's routes.
- **Per-project rows read the selected containers.** Progress and Done list the first 100
  chosen rows with their `progress`; a site with more shows those and the totals.
- **Time left** is this page's own reading: from the first poll it saw to the latest, so a job
  opened halfway is not estimated from its start, and a Retry starts a fresh rate.
- **Phone.** Mapping rows stack (source over target, arrow hidden), the option grid and the
  review list go to one column, the people numbers to two.
