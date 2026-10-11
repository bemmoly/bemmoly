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
- Not: a module-local card or row. Docs' issue embeds and Inbox details use the Work module's
  renderers through the entity registry, which draw these.
- States: rest; hover tools (`tools`) on hover and keyboard focus, always on touch; `selected`
  (accent tint); `checked` and `selecting` (the round check on the corner); `pending` (dims to
  60% after a 160ms beat while an optimistic edit is in flight); dragging (lifted, `shadow-e1h`);
  dropped (`animate-settle`); skeleton.

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

### KeyChip

`import { KeyChip } from '@bemmoly/ui'`. An issue key (PLT-204), mono, `tx-3` on cards and rows.
Not a keyboard key; that is `Kbd`.

### Issue page sections

`IssueSection`, `SectionHeading`, `PropertyGroup`, `PropertyRow`, `PropertyValue`, `FieldList`,
`ActivityItem`, `HistoryItem`, `CommentComposer`, `SubtaskRow`, `LinkedIssueRow`, `CriteriaRow`,
`ChecklistBlock`, `SaveState` · Story: Components/IssueSections. Values edit in place; an empty
value reads "Add …"; every edit shows at once and rolls back with a toast on refusal.

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

Their icons are `EDITOR_ICONS` names on `Icon` (`text`, `heading`, `highlight`, `row-add`, …,
with #77). The page column is a 700px measure and properties sit in one 28px row. The page
title's 36px is the one recorded exception to the type scale (see
[tokens.md](tokens.md#type)).
