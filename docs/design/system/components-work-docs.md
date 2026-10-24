# Components: the issue vocabulary and the Docs surfaces

The parts that Work and Docs draw, and that other modules draw when they show an issue or a page.
Imports are from `@bemmoly/ui` unless the entry says otherwise. General components are in
[components.md](components.md).

## The issue vocabulary

### TypeGlyph, PriorityGlyph, StatusGlyph

`import { TypeGlyph, PriorityGlyph, StatusGlyph, statusStage } from '@bemmoly/ui'` · Stories:
Foundations/Glyphs, Components/Board vocabulary
([`glyphs.stories.tsx`](../../../packages/ui/src/components/glyphs/glyphs.stories.tsx),
[`board-vocabulary.stories.tsx`](../../../packages/ui/src/components/glyphs/board-vocabulary.stories.tsx))

```tsx
<TypeGlyph type="story" />                                 // 14px on cards and rows, 16 in menus
<PriorityGlyph priority="high" />                          // null draws "No priority"
<StatusGlyph stage={statusStage(status.category, status.name)} label={status.name} />
```

- **TypeGlyph**: a tile at the logo's corner ratio in the type colour, a white mark. Custom
  types carry their stored icon and colour (`typeLook`, `TYPE_ICON_CHOICES`,
  `TYPE_COLOR_CHOICES`).
- **PriorityGlyph**: three neutral signal bars; only Urgent (`highest`) is red. Never colour the
  other levels.
- **StatusGlyph**: a circle that fills as work moves right (backlog dashed, to do empty, in
  progress a quarter, review half, QA three quarters, done full, won't do crossed), coloured by
  category only. Beside its visible name, pass `decorative` so the name is read once.
- Not: a coloured pill, a text label in capitals, a Unicode shape. A status is its glyph and its
  name in sentence case.

### IssueCard and IssueRow

`import { IssueCard, IssueRow, IssueCreateRow, IssueCardSkeleton, IssueRowSkeleton } from '@bemmoly/ui'`
· Stories: Components/IssueCard, Components/IssueRow
([`issue-card.stories.tsx`](../../../packages/ui/src/components/issue-card/issue-card.stories.tsx),
[`issue-row.stories.tsx`](../../../packages/ui/src/components/issue-row/issue-row.stories.tsx))

- Use: `IssueCard` on boards and anywhere an issue is a tile; `IssueRow` in lists (Backlog, Home,
  My issues, search). Same fields, same order: type, key, title, then labels, epic, priority,
  estimate, assignee. The row's grid is `ISSUE_ROW_GRID`.
- On a board the card draws exactly the board's card fields (ADR 0029): every part but the title
  is optional (`showType`, `showKey`, `due`, `created`, `reporter`, `age` and the rest), and
  `order` sets each side of the footer in the board's order. A part with no value is left out;
  `assignee={null}` is the empty ring. The Cards settings preview draws the same card.
- Not: a module-local card or row. Docs' issue embeds and Inbox details use the Work module's
  renderers through the entity registry, which draw these.
- States: rest; hover tools (`tools`) on hover and keyboard focus, always on touch; `selected`
  (accent tint); `checked` and `selecting` (the round check on the corner); `pending` (dims to
  60% after a 160ms beat while an optimistic edit is in flight); dragging (lifted, `shadow-e1h`);
  dropped (`animate-settle`); skeleton.
- Date warning: `warning` takes a `DateWarningChip` (amber, the `warning` icon, under the blocked
  chip) when the issue's dates run past its epic's target. It is a button: it opens a `Menu`
  with the two fixes, "Extend <epic> to <day>" and "Move <issue> to end <day>". The roadmap's
  issue rows show the same chip at the end of the name cell. Without permission to change
  dates it only names the problem.

### FilterBar

`import { FilterBar, FilterChipButton, AppliedFilterChip, GroupSwitch, QuickFilters, QuickFilterChip } from '@bemmoly/ui'` ·
Story: Components/FilterBar ([`filter-bar.stories.tsx`](../../../packages/ui/src/components/filter-bar/filter-bar.stories.tsx))

- Use: the one filter row on Board, Backlog and any list that filters: search (focus with `/`),
  the quick filters, applied chips each removable, the Filter menu, saved views, Clear from two,
  Group, Display.
- Quick filters (`QuickFilters`, ADR 0023): one solid toggle chip per quick filter, right after
  search, never inside the Filter menu. Off is `border-line` and `tx-2`; on is the accent tint
  (`bg-acc-50`, `border-acc-100`, `text-acc`) with a check and `aria-pressed`. Up to four in the
  row (two on a phone), the rest behind a dashed "+N more" menu; one that is on always shows.
- Display holds personal view choices only (empty columns). How cards look is the board's,
  set in Board settings › Cards; never offer card fields or density per person.
- Rules: filters live in the URL; filters hide, never fade; counts follow what is shown.

### Board and backlog parts

`KanbanColumnHeader`, `KanbanColumnHeaders`, `KanbanCell`, `Swimlane`, `SwimlaneHeader`,
`SprintHeader`, `SprintContainer`, `SprintProgress`, `EpicPanel`, `EpicItem`, `CapacityBar` ·
Stories: Components/KanbanColumn, Components/Swimlane, Components/SprintHeader, Components/EpicPanel.
Epic colour comes from `epicColor(stored, id)` and is the same on every screen. WIP reached and
"ends today" are amber; refused drops are an amber dashed cell with the reason inside.

### Roadmap timeline

`TimelineHeader`, `TimelineGrid`, `TimelineBar`, `DependencyLines`, `ForecastChip`, and the axis
helpers `timelineScale`, `timelineTicks`, `dayOfIso`, `shortDate` · Story: Components/Timeline
([`timeline.stories.tsx`](../../../packages/ui/src/components/timeline/timeline.stories.tsx)).

- Use: the Roadmap only (`../premium/interaction/roadmap.md`). Days are UTC day numbers; a zoom
  (`weeks`, `months`, `quarters`) sets a day's width. The header is months over weeks, or
  quarters over months; today is the accent line and chip.
- `TimelineBar`: one button per item. An epic is its own hue (`epic-N` at 15%, the done share
  at 30%, its name inside when it fits); a version is neutral with a release mark. Past the
  target, a hatched amber stretch to the forecast; under it, the forecast whisker (quiet ink,
  amber when at risk or late). Grips show on hover, focus and touch only when it can move.
- `ForecastChip`: the forecast in words: On track (green), At risk and Late (amber), Done (the
  status glyph), and quiet text for no target, too early to tell and no issues. Never lilac:
  the forecast is arithmetic, not AI.
- `DependencyLines`: elbows from a blocker's end to the waiting bar's start, amber and dashed
  when the plan has the waiting item start first. Decorative; rows say it in words.
- Not: a second chart style for dates, red for lateness, or violet for anything but an epic.
- States: pending (dims after a beat), dragging (lifted, dates above it), no stored start
  (faded edge), no target (dashed outline), child bars (10px, no label).

### KeyChip

`import { KeyChip } from '@bemmoly/ui'`. An issue key (PLT-204), mono, `tx-3` on cards and rows.
Not a keyboard key; that is `Kbd`.

### Issue page sections

`IssueSection`, `SectionHeading`, `PropertyGroup`, `PropertyRow`, `PropertyValue`, `FieldList`,
`ActivityItem`, `HistoryItem`, `CommentComposer`, `SubtaskRow`, `LinkedIssueRow`, `CriteriaRow`,
`ChecklistBlock`, `SaveState` · Story: Components/IssueSections. Values edit in place; an empty
value reads "Add …"; every edit shows at once and rolls back with a toast on refusal.

### CodeLinkRow

`import { CodeLinkRow, CODE_STATE_LABELS, CODE_REVIEW_LABELS } from '@bemmoly/ui'` · Story:
Components/IssueSections/Development
([`code-link-row.stories.tsx`](../../../packages/ui/src/components/issue-sections/code-link-row.stories.tsx))

- Use: a pull request, branch or commit in an issue's Development section, inside a
  `ListCard`, grouped with `ListGroupLabel` when more than one kind is listed.
- Drawing: the state icon (`pull-request` in `prog` when open, `pull-request-draft` and
  `pull-request-closed` in `tx-3`, `merged` in `done`; `branch` and `commit` in `tx-3`), the
  reference in mono, the title, the repository from 640px, the checks mark (`check` green,
  `close` red, `clock` amber, each named), the review in words and the state in words.
- Not: a capitalised state pill, purple for merged (lilac is AI's), or colour alone.
  The row opens the code host in a new tab and says so to assistive tech.

### WorkflowCanvas

`WorkflowCanvas`, `StatusNode`, `TransitionEdge`, `RuleChip`, `WorkflowLegend` · Story:
Components/WorkflowCanvas. The workflow editor only; it is a `full` layout editor.

### StatusBadge (older)

`StatusBadge` and `StatusButton` are the first release's capitalised status pills. New UI draws
`StatusGlyph` beside the status name instead; existing uses move over when their screen is next
touched.

## Docs surfaces

### Lists, spaces and templates

`DocListRow`, `DocListRowSkeleton`, `AttentionList`, `AttentionItem`, `SpaceCard`, `SpaceTile`,
`TemplatePicker`, `TemplateCard`, `StartGuide` · Stories: Docs/Home, Docs/Template picker,
Docs/Start guide ([`docs-home.stories.tsx`](../../../packages/ui/src/components/doc-list/docs-home.stories.tsx)).
Spaces are rows in the sidebar, never a space switcher (`SpaceSwitcher` is removed with #77).

### PageTree

`import { PageTree, PageTreeRow } from '@bemmoly/ui'` · Story: Docs/Page tree
([`page-tree.stories.tsx`](../../../packages/ui/src/components/page-tree/page-tree.stories.tsx))

- Use: the current space's pages, in the sidebar's Docs section. 28px rows, 14px per level, the
  open page raised; + and ··· on hover and focus; drag with a depth-aware drop line.
- Keys: ↑↓ move, → ← open and close, Enter opens, F2 renames, Alt with arrows reorders and nests,
  a letter jumps.
- States: four skeleton rows; an empty space's one New page row; "Pages did not load" with Retry.
- Kinds (ADR 0049): a folder without an icon of its own draws `folder`, a file page
  `file-page`, through the row's icon value (`iconOfPage` in Docs). New folder (the space's ···)
  and New folder inside (a row's ···) open the new folder with its row already renaming.
- `addMenu`: when more than one kind of thing can be added, the row's + opens a menu instead
  of acting at once. In Docs the space row's + and every page row's + offer Page, Folder and
  Upload file (`AddMenuItems`); Upload file makes the picked file a file page right there.
  N still makes a page at once.

### File page and folder

A page's kind (ADR 0049) decides what sits under the one header. Both keep the trail, star,
Share and ··· (Copy link, Turn into a page, Move to…, Move to trash); neither has an editor,
outline, comments margin or version history.

- **File page**: one HTML or PDF file, drawn by `FileEmbed` with `fill`, edge to edge under the
  header: the 40px file bar, then the file filling the rest, no card box or radius. The status
  menu stays beside the trail. ··· adds Replace file…; a body that no longer holds one file shows
  an `EmptyState` saying how to fix it.
- **Folder**: the `contained` measure (`max-w-260`) inside the full layout's pane: the folder
  icon and title at `text-20`, the item count, New page (primary, N) and New folder, then its
  children as `PageRow`s in tree order on a `Card`. Empty: an `EmptyState` with the same two
  buttons. No status menu: a folder is never reviewed.
- A written page offers Turn into a folder in ··· while its body is empty, and Show as a file
  page while its body is exactly one PDF or HTML file.

### Page identity and status

- `PageIcon` from `@bemmoly/ui/icons`: a drawn icon in one of the eight entity tints, stored as
  `name:epic-N` (tints `PAGE_ICON_TINTS`, helpers `formatPageIcon`, `parsePageIcon`: with #77).
  Older emoji icons still draw.
- `PageStatusMark` (with #77): a page's status as the status glyph and its name, in the header's
  status menu and in lists. `PageStatusPill` (capitals on a tinted chip) is the older form and is
  not used by new UI.

### The editor

From `@bemmoly/editor`: `RichTextEditor` (descriptions, comments), `DocEditor` (Docs pages),
`RichTextView` (read-only), each loaded on first use. Stories: Editor/Slash menu, Editor/Docs
nodes (`packages/editor/src/doc/stories/`).

The Docs writing surfaces live inside `packages/editor/src/doc/` and are reached through
`DocEditor`, never mounted by a module (with #77):

| Surface                | File                                       | Rule                                                    |
| ---------------------- | ------------------------------------------ | ------------------------------------------------------- |
| The / menu             | `slash-items.ts`, `../editor/suggestion-list.tsx` | Groups: Basic blocks, AI (only when AI is on), Insert, From Work; a 32px icon tile, name, second line, Markdown key cap |
| Block handles and menu | `block-handle.tsx`, `block-menu.tsx`, `turn-into-menu.tsx` | + and grip on hover and on the selected block; Turn into, Duplicate, Copy link (headings), Delete with Undo |
| Selection bubble       | `bubble-menu.tsx`                          | 8px above the selection; Turn into, B I S code link highlight, Comment, Ask AI in lilac only with AI on |
| Link picker (Mod+K)    | `link-picker.tsx`                          | One field: an address, or pages and issues by search    |
| Code and table tools   | `code-tools.tsx`, `table-tools.tsx`        | Icon buttons with tooltips; table deletes in `red`      |
| Issue card block       | `views/issue-card-view.tsx`                | Work's issue card in a page; the key on a quiet card when Work is off |
| File block             | `views/file-view.tsx`                      | A PDF or HTML file in `FileEmbed`; an empty block is an Upload card; Expand on images too |

### FileEmbed and FileViewer

`import { FileEmbed, FileViewer, fileEmbedKind } from '@bemmoly/ui'` · Story: Docs/File embed
(`packages/ui/src/components/file-embed/`). Decision: ADR 0047.

- Use: a stored file shown in a page: an HTML page an agent wrote, a PDF, an image full screen.
  The 40px bar on `sunken` names the file, its kind (HTML, PDF, Image) in `tx-3`, then Download
  (HTML) or Open in a new tab (PDF, image) and Expand; the file sits below in a 360px box on a
  `card` surface with the card radius and a `line` border.
- Expand opens `FileViewer`: the same bar with Close in place of Expand, the file filling a
  `full` Modal. Escape closes it; the frame exists only while it is open.
- HTML always runs in its sandboxed frame (`allow-scripts`, never `allow-same-origin`); PDF in
  the browser's viewer. The bar is never hidden, so a form inside a file never passes for the
  app.
- `fill`: no box; the embed takes the space it is given (`flex-1`) and the file fills it under
  the bar. Only for a page that is the file (File page above). Story: Docs/File embed › Fill.
- Not: for files the page links to without showing (use a link); never a frame of an outside
  site.

Their icons are `EDITOR_ICONS` names on `Icon` (`text`, `heading`, `highlight`, `row-add`, …,
with #77). The page column is a 700px measure and properties sit in one 28px row. The page
title's 36px is the one recorded exception to the type scale (see
[tokens.md](tokens.md#type)).
