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
back to it while the import has not started (Choose back to Connect keeps the typed form; the
plan back to Choose keeps the selection); a step ahead is plain text. On a phone only the
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
4. **Options.** **Interim**: Continue plans what is ticked (PATCH with an empty body) and shows
   today's plan panel (mapping rows and Start import) as the step after Choose. **Planned**
   (phase 2): what to bring, where each project goes (new key or existing), people, fine print.
5. **Review.** **Planned** (phase 2): one definition list of everything Start will do, the
   time estimate, Start import. No confirm dialog; Cancel and Resume are the safety.
6. **Import.** **Built** (unchanged): the overall bar and phase, Cancel import. **Planned**:
   one row per project with its own bar.
7. **Done.** **Built** (unchanged): totals per kind, the first skipped rows, Run again,
   Resume. **Planned**: one row per project with Open board, Retry for a failed project, the
   skipped list as CSV.

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

None in this release: the open job, the step, the search and the filter live in page state;
Recent imports reopens a job at its step after a reload. Search and filter in the URL wait for
the import route to move under its own path.

## Setup wizard: the short path

**Interim.** The wizard uses the same `ImportFlowBody`, so it shows Connect, the chooser and
the plan without the stepper; its copy is unchanged. **Planned:** Connect, choose, Start import
with defaults for options and mapping, key clashes falling back to a suffixed key listed in the
report, no claim the importer cannot keep, and the run continuing in the background. Before the
modules are on, the importers stay visible but not pickable ("Needs Work", "Needs Docs").

## Choices recorded

- **Rows are listbox options, not grid rows.** The tick drawn in each row is the shared
  `Checkbox`, hidden from assistive tech and out of the tab order, so an option holds no
  interactive content; the option's `aria-selected` is the tick.
- **The header box over a filtered view.** All ticked plus a click unticks what is shown with
  Undo (the design snapshots the ticks). Over the whole list that is a clear (Undo sends
  restore); over a search or filter it unticks that scope and Undo ticks it again.
- **Status words.** "Imported Oct 2" and "Key in use" carry their explanation for screen
  readers instead of a hover title, since the system has no native titles.
- **The plan is the interim Options step.** The stepper marks it Options; phase 2 replaces the
  panel without moving the seam (`flow.step === 'options'`).
