# Interaction

Restyling is half the job. Every screen behaves like a premium product. These twelve rules are in
priority order: when two pull apart, the earlier one wins, and the choice is recorded in the
screen's interaction notes.

Ask while building: what would a demanding user try next here, and what happens?

## The twelve rules

### 1. Act where the data is

- Edit a field where it is shown: inline popovers for assignee, status, priority, points,
  labels and dates. No separate edit form for a small change.
- Create in place: a column's "New issue", the current project and sprint as defaults; Docs'
  New page makes "Untitled" where you are. Global create opens over the current page
  (`?create=`), never on a new route.
- Check: no small action navigates away.

### 2. Feedback within 100ms

- Every mutation that can be rolled back is optimistic: it shows in the same frame on every
  cached view, with a quiet pending state (`pending` dims after a 160ms beat) and a per-item
  rollback with a toast on refusal.
- Buttons show progress (`loading`) and never double-submit.
- Check: throttle the network; the UI answers at once and recovers cleanly from a 500.

### 3. Undo over confirm

- Reversible destructive actions (delete issue, remove label, move to backlog, archive, trash a
  page, resolve a thread) happen at once with `toast.undo(…)` for about 6 seconds.
- Only truly irreversible actions confirm, with `ConfirmChange` and a typed word where the loss
  is large (restore a backup, purge).
- Check: no "Are you sure?" dialog guards anything Undo could put back.

### 4. Keep context and URL state

- An issue opened from a list is the peek at `?issue=KEY`: Back and Forward work, a reload
  restores it.
- Filters, grouping, view, segment and the selected item live in the URL.
- Returning to a list restores its scroll position and selection.
- Closing an overlay returns focus to whatever opened it.
- Check: copy the URL into a new tab; you land on the same view.

### 5. Keyboard first, discoverable

- Every list moves with ↑↓ and J K, opens with Enter, closes with Esc.
- Global keys are in the map below. Every icon button has a tooltip naming the action and its
  key (`IconButton keys`, `Tooltip keys`). The `?` overlay lists every key on the screen
  (`useShortcutHelp`, `useScreenActions`).
- Single keys and chords never fire while typing in a field, inside a dialog or menu, or with
  Alt held (`typingInField`, `useGlobalKeys`). Mod+K works everywhere.
- Check: complete the screen's top three actions without the mouse.

### 6. Hover reveals, never hides

- Secondary actions (row menu, quick assign, grip, +) appear on hover and on keyboard focus,
  and are always visible on touch or on long-press.
- Everything is also in a right-click or ··· menu.
- Check: Tab through a row; every hover action appears.

### 7. Designed states

- Skeletons match the final layout; nothing shifts when data lands.
- Empty states have one clear primary action and its shortcut.
- Errors say what happened in plain words, with Retry.
- Long text truncates with a tooltip; relative times show the absolute date on hover; numbers
  are tabular.
- Check: the screen's notes list loading, empty, error, partial, many items and no permission,
  and each is visible in a story or a screenshot.

### 8. Motion with purpose

- 120 to 180ms ease-out to enter, about 100ms to exit; transform and opacity only.
- Panels slide, menus scale from their trigger, toasts rise, dropped cards settle.
- Drag shows a lifted card, a placeholder, a drop indicator, auto-scroll, and explains a refused
  drop.
- `prefers-reduced-motion` stops it all. No bouncing, nothing gratuitous.

### 9. Selection and bulk

- Rows and cards show a checkbox on hover and focus; Shift-click selects a range, Mod-click
  toggles one; X toggles the focused item.
- One floating `BulkBar` offers the actions that apply (assign, status, priority, sprint,
  labels, move, delete with Undo). Esc clears the selection.

### 10. Calm density

- One alignment grid; no needless borders or cards inside cards.
- Colour spent on meaning only (type, status category, urgency, epic).
- Targets at least 32px, 44px on touch. Focus rings always visible on keyboard focus.
  Text at least 4.5:1.

### 11. Words

- Sentence case, verbs on buttons, no jargon or internal names, errors that say what to do
  next. See [content.md](content.md).

### 12. Quiet delight, earned

- Presence faces, smooth progress, a short sprint-complete summary, a satisfying drop, the
  "Copied" confirmation. Never at the cost of speed.

## Shortcut map

Global (the shell, `useGlobalKeys`):

| Keys          | Does                                                       |
| ------------- | ---------------------------------------------------------- |
| Mod+K         | Open or close the palette                                  |
| /             | Search (the palette; on a filtered list, its search field) |
| C             | The primary create over the current page (New issue)       |
| [             | Fold or unfold the sidebar                                 |
| ?             | The shortcuts overlay                                      |
| G H, G I      | Home, Inbox                                                |
| G + a letter  | A module's place (G B Board, G L Backlog)                  |

Lists and dialogs: ↑↓ or J K move, Enter opens, Esc closes or clears the selection, Tab filters
by type in the palette, Mod+Enter submits a dialog from any field.

Per screen (registered with `useScreenActions` so `?` lists them): Board and Backlog, I assign to
me, X select, Delete with Undo; Inbox, E done and S snooze; Docs, N new page and Shift+N new
page inside, and the editor's keys (with #77, in `../premium/interaction/docs-editor.md`).

Rules for a new key:

- A single letter only when the screen has no text field focused by default, and it must not
  collide with the global map. Navigation is always `G` plus a letter, declared on the
  module's navigation entry (`keys: 'G X'`).
- Every key appears in the `?` overlay and in the tooltip of the control it triggers.
- Mod-chords follow platform convention (Mod+Z undo, Mod+B bold); never rebind them.

## Notes every new screen needs

Before building a screen, write its notes in `docs/design/premium/interaction/<area>.md` (and
link it from `docs/design/premium/interaction.md`). The pull request is not reviewed without
them. Each screen gets:

1. **Primary job**, in one sentence.
2. **Top three actions**, and how each is reached by mouse, keyboard and touch.
3. **Keyboard map** for the screen, checked against the global map.
4. **States**: loading, empty, error, partial, many items (hundreds), no permission, phone.
5. **URL state**: what lives in the address.
6. **Choices recorded**: where this folder or the review was silent or wrong, what you chose and
   why. If it should become a rule, follow [changing-the-system.md](changing-the-system.md).
