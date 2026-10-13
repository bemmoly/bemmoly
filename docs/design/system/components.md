# Components

Every shared component, where it comes from, when to use it, when not to, and the states it must
show. All import from `@bemmoly/ui` unless the entry says otherwise. Stories run with
`pnpm --filter @bemmoly/ui storybook` (port 6006); "Story" names the Storybook title and file.
The issue vocabulary and the Docs surfaces are in [components-work-docs.md](components-work-docs.md).

Rule for every entry: a page never redraws one of these. If it needs something they do not do,
it adds a prop or variant here, with a story, in the same pull request.

`S` below is `packages/ui/src/components/`.

## Shell (from `@bemmoly/core-web`)

### PageLayout and PageHeader

`import { PageLayout, HeaderActions, HeaderPresence, useHeaderTrail } from '@bemmoly/core-web'`

- Use: every page inside the frame. See [layout.md](layout.md).
- Not: the setup wizard and pre-sign-in pages. Never import `PageHeader` to draw a header
  inside a page; `PageLayout` draws the only one.
- States: the header paints at once, before data; actions portal in when the screen is ready.
- Note: `@bemmoly/ui` also exports `PageTitle` (alias `PageHeader`), the older in-content title
  block. New screens do not use it; the shell header replaces it.

### SidebarRow, SidebarHeading, SidebarSection, SidebarLabel, BottomBar, PresenceFacepile, SwitcherMenu

`@bemmoly/core-web`. For module `sidebar.tsx` entries, the phone bar and the header's presence.
Rows are 28 to 32px, current row raised (`bg-card shadow-e1`), counts in `tx-3` tabular, unread
as an accent pill. `SidebarHeading` with a `tile` is a module's 32px header row (20px tile, 13px
semibold, `current` for full ink and a shown "+"); without one it is an 11px caption (Settings).
`SidebarSection` wraps a module's section and puts the current one on a faint accent wash;
`SidebarLabel` names a list inside it ("Projects", "Spaces") (ADR 0037). `SwitcherMenu` is the
searchable crumb switcher (projects), never a workspace switcher. The sidebar footer's person
row ends in the Appearance button: a `Menu` whose trigger is the current mode's icon and whose
items are Light, Dark and Match system as radios; nothing else about appearance lives in the
sidebar or the person's menu.

## Actions and controls

### Button and IconButton

`import { Button, IconButton } from '@bemmoly/ui'` · Story: Components/Button
([`button.stories.tsx`](../../../packages/ui/src/components/button/button.stories.tsx))

- Use: `Button` for every labelled action. `variant`: `primary` (one per view: the action the
  screen exists for), `secondary` (default), `ghost` (quiet, in toolbars and rows), `danger`
  (destructive, in its confirmation). `size`: `md` (32px) default, `sm`/`xs` in rows, `lg` in
  setup and dialogs' main action, `touch` on the sign-in pages (40px; 46px with 16px text on
  phones). `loading` keeps the label and shows a spinner at full contrast (busy, not faded).
- `IconButton` for icon-only actions: `label` is required and becomes its tooltip; pass `keys`
  for the shortcut and `tip` when the label is long.
- Not: a `<button>` with custom classes, a link styled as a button for an action, two primaries.
- States: rest, hover (`bg-hover`), pressed (`bg-press`), focus ring, disabled (fades),
  loading (no double submit).

### Input, SearchInput, Field, Textarea, Select, Checkbox, Radio, Switch, SegmentedControl

`@bemmoly/ui` · Stories: Components/Input, Components/Select, Components/Controls
([`input.stories.tsx`](../../../packages/ui/src/components/input/input.stories.tsx),
[`select.stories.tsx`](../../../packages/ui/src/components/select/select.stories.tsx),
[`controls.stories.tsx`](../../../packages/ui/src/components/checkbox/controls.stories.tsx))

- `Field` wraps every labelled control: label, hint, error under the field. Never a bare input
  with a placeholder as its label.
- `Select` is the only dropdown: one custom listbox with search, a tick on the chosen option,
  "Showing 50 of N" for long lists, async options (`LoadOptions`), groups. Never a native
  `<select>`.
- `Switch` applies at once (settings toggles); `Checkbox` is chosen then saved (forms, selection).
- `SegmentedControl` for two to five exclusive views ("All · 8").
- `Input size="touch"` on the sign-in pages: 40px, and 46px with 16px text under 640px so a
  phone never zooms into the field.
- States: rest, hover, focus ring, error (`red` border and `red-tx` message), disabled,
  read-only (`sunken`), loading options ("Searching…"), no matches.

### PasswordInput

`import { PasswordInput, passwordStrength } from '@bemmoly/ui'` · Story:
Components/PasswordInput ([`password-input.stories.tsx`](../../../packages/ui/src/components/password-input/password-input.stories.tsx))

- Use: every password field, inside `Field`. `autoComplete` is required:
  `current-password` to sign in, `new-password` to set one (reset, invitation, setup). It sets
  `name="password"`, so password managers save and fill it.
- A show or hide button (`aria-pressed`, "Show password"), a "Caps Lock is on" line while the key
  is on, and `meter` for the strength meter under a new password. Both lines join the input's
  description. The meter is a guide; the length policy is the only rule.
- Not: `Input type="password"`, a second "Type it again" field (show or hide replaces it), or a
  strength rule that refuses a long passphrase.

### Menu, MenuItem, MenuGroup, MenuSeparator, Dropdown

`@bemmoly/ui` · Story: Components/Menu, Modal, Tabs, Toast, Tooltip
([`overlays.stories.tsx`](../../../packages/ui/src/components/menu/overlays.stories.tsx))

- Use: every ··· menu, right-click menu, create menu and filter menu. Floating layer, so it is
  never clipped; 180 to 320px wide; `tone="danger"` for destructive items; `hint` for a shortcut
  (`<Kbd>`); `checked` with `kind` for radio and checkbox items.
- Not: a hand-built popover list. Group labels are sentence case, never capitals.
- States: opens from its trigger (`pop-in`), arrow keys, Home, End, Enter, Escape returns focus.

### Tabs and TabPanel

`@bemmoly/ui` · Story: overlays.stories.tsx (UnderlineTabs). For tabs inside content (a card's
sections, Home's segments). The page's view tabs are `PageHeader` `tabs`, not this.

## Overlays

### Modal

`import { Modal } from '@bemmoly/ui'` · Story: overlays.stories.tsx (ConfirmModal)

- Use: every dialog. `width`: `sm` 400, `md` 480, `lg` 640, `composer` 720, `xl` 760. `title`
  is required (its accessible name); footer buttons sit outside the scrolling body.
- Not: for small edits that can happen in place (use a popover or inline edit); never a
  confirmation for something Undo can reverse.
- States: `dialog-in` 180ms over a flat scrim, focus trapped and returned to the opener, Escape
  closes (or asks once when something is typed), full-screen sheet under 640px.

### Drawer (the peek)

`import { Drawer, DrawerTitle } from '@bemmoly/ui'` · Story: Components/Drawer
([`drawer.stories.tsx`](../../../packages/ui/src/components/drawer/drawer.stories.tsx))

- Use: the issue peek (`?issue=KEY`) beside a list: `docked` 400px when there is room,
  `overlay` with a scrim when not. Arrows step through the list; closing returns focus.
- Not: a second page. Long forms go in a `Modal`; settings never slide over.

### Tooltip and Kbd

`import { Tooltip, Kbd } from '@bemmoly/ui'` · Stories: Foundations/Feedback, Foundations/Kbd
([`feedback.stories.tsx`](../../../packages/ui/src/components/toast/feedback.stories.tsx),
[`kbd.stories.tsx`](../../../packages/ui/src/components/kbd/kbd.stories.tsx))

```tsx
<Tooltip label="New issue" keys="C"><IconButton … /></Tooltip>
<Kbd keys="Mod+K" />   // ⌘K on Apple platforms, Ctrl K elsewhere, drawn as icons
```

- Tooltip: every icon-only control has one (IconButton draws it for you). Opens after 400ms of
  hover, at once on keyboard focus, at once between neighbours within 300ms. Never the only
  place information lives; never a native `title`.
- Kbd: every key hint. `keys` in words (`Mod+K`, `Shift+N`, `Up Down`, `Esc`). The only place a
  key symbol may appear. `KeyChip` is different: it is an issue key (PLT-204), not a keyboard key.

### CommandPalette

`@bemmoly/ui` (`CommandPalette`, `CommandList`, `CommandItem`, …) · Story: Components/CommandPalette.
The shell owns the one palette (`Mod+K`); modules add search providers and screen actions
(`useScreenActions`), never a second palette.

## Feedback

### Toast with Undo

`import { useToast } from '@bemmoly/ui'` · Story: Foundations/Feedback (UndoToast)

```tsx
const toast = useToast();
toast.undo({ title: 'PLT-219 deleted', onUndo: restore });           // reversible: no confirm
toast.show({ tone: 'danger', title: "Couldn't save the title", body: 'Check your connection and try again.' });
```

- Use: confirmation of an action that happened, Undo for about 6 seconds (`TIMING.toastMs`,
  paused on hover and focus), errors with Retry.
- `tone`: `info`, `ok`, `warn`, `danger`, and `ai` only for AI output.
- Not: for validation (that goes under the field), or for information the page already shows.

### RelativeTime

`import { RelativeTime } from '@bemmoly/ui'` · Story: Foundations/States (RelativeTimes).
"3h ago", absolute date and time on hover and for assistive tech, a real `<time>`. Every
timestamp in the product. Formatting helpers: `formatRelative`, `formatAbsolute`.

### Skeletons

`Skeleton`, `SkeletonText`, `SkeletonRow`, `SkeletonCard`, `SkeletonHeader`, `TableSkeleton`,
`IssueCardSkeleton`, `IssueRowSkeleton`, `DocListRowSkeleton` · Story: Foundations/States
([`states.stories.tsx`](../../../packages/ui/src/components/skeleton/states.stories.tsx)).
Same heights and gaps as the loaded layout, so nothing shifts; the region is `aria-busy`. No
spinners for content; `Spinner` is for a button or a field only.

### EmptyState and StartGuide

`import { EmptyState, StartGuide } from '@bemmoly/ui'` · Story: Docs/Start guide.
`EmptyState`: an icon tile, a title, why it is empty, one primary action with its shortcut.
`StartGuide`: a first-run checklist. A filtered empty list says so and offers "Clear filters".

### Errors

No separate component: an error state is `EmptyState` with the `warning` icon, plain words for
what happened, what was not lost, and Try again (Retry in tight rows). Pages that fail stay in
the frame (`ErrorBoundary` from `@bemmoly/core-web`), with the request id.

## Data

### Table

`import { Table, TableSkeleton } from '@bemmoly/ui'` · Story: Components/Table
([`table.stories.tsx`](../../../packages/ui/src/components/table/table.stories.tsx))

- Use: the one table style: projects, members, audit, backups, workflows. `label` names it;
  `density` `md` 44px or `sm` 40px; `sort`, `footer`, `empty`, `isMuted` for rows awaiting Undo.
- Not: a grid of divs with borders, or a second table style. Narrow screens scroll it sideways
  inside its card, never the page.

### BulkBar and selection

`import { BulkBar } from '@bemmoly/ui'`. The one floating bar for a selection: count, the
actions (Assign, Priority, Move to, Delete with Undo) and clear (Esc). Rows and cards show their
checkbox on hover and focus; Shift-click extends, Mod-click toggles.

### Card, SelectableCard, SettingsFrame, SettingsSection, FormGrid

`@bemmoly/ui` · Stories: Components/Card, Components/SettingsFrame, Components/Settings edit
pattern, Components/FormLayout. Settings pages are `SettingsSection` read views with Edit,
Cancel and Save, a confirmation (`ConfirmChange`, typed word for the irreversible) and the
`UnsavedChangesBar`. Never a card inside a card.

### Avatar, AvatarStack, Label, Tag, Badge

`@bemmoly/ui` · Story: Foundations/People and labels
([`people.stories.tsx`](../../../packages/ui/src/components/avatar/people.stories.tsx))

- `Avatar`: initials on an avatar hue, the signed-in person on the accent; `UnassignedAvatar`
  for none. `AvatarStack` for groups, ringed (`ring`) when overlapping. An issue with several
  assignees draws them as one stack in the card's assignee slot (`coAssignees`), the primary
  first, three faces then "+N"; the issue page lists each by name with an Unassign button.
- `Label`: an outlined pill with a colour dot (the label's stored colour); `onRemove` adds a
  named remove button. Labels are never filled pills.
- `Tag` and `Badge`: neutral chips; sentence case, never capitals.

### EntityTile and ProjectTile

`import { EntityTile } from '@bemmoly/ui'` · Story: Foundations/EntityTile
([`entity-tile.stories.tsx`](../../../packages/ui/src/components/entity-tile/entity-tile.stories.tsx))

- Use: every square identity mark: workspace (`tone="ink"`), module (`work`, `docs`, `ai`),
  team, space (`hue`), an uploaded logo (`src`). A project is `ProjectTile` from Work's
  `shared/project-tile.tsx`, an `EntityTile` on its name's hue, everywhere.
- Not: initials in a coloured circle (that is an Avatar, for people only).

### Progress and metrics

`ProgressBar`, `MetricTile`, `CapacityBar`, `MetricSparkline` · Story: Components/MetricTile.
Bars are `rounded-tick`; done is `done`, in progress `prog`; never a signal colour for progress.
