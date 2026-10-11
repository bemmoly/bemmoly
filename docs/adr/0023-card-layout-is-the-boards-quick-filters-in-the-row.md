# ADR 0023: Card layout is the board's; quick filters sit in the filter row

- Status: accepted; decision 1 changed by [ADR 0029](0029-cards-draw-exactly-the-boards-fields.md)
- Date: 2026-10-11
- Changes: the "Display" decision in
  [`docs/design/premium/interaction/board-backlog.md`](../design/premium/interaction/board-backlog.md)
  (card fields and density were personal, per person and board, in the browser)
- Evidence: owner feedback on 0.10.0

## Context

The Board's Display menu let each person turn card fields on and off and pick a compact density,
kept in their browser. Project settings › Board › Cards already sets the card layout (fields,
order, card colour and colour rules) with an org default and a per-project override, behind
"Configure board". Two places deciding how a card looks meant a standup screen and a laptop
showed different cards for the same board, and an admin's layout was only a suggestion. The
owner wants cards to look the same for everyone, set only by admins.

Quick filters ("Only my issues", "Recently updated", "Blocked" and the project's own from Board
settings › Quick filters) sat inside the Filter menu, two clicks away, and showed as removable
chips once on. They are the most used filters and read as hidden.

## Decision

1. **The card layout is the board's alone.** Cards draw exactly the board config's
   `cardFields`, `colorRule` and `colorRules`, plus the time in column on Kanban. The Board has no
   per-person card fields and no density. Views stored in the browser by earlier versions keep
   only their empty-column choice; card fields and density in them are dropped on read.
2. **Writes need "Configure board".** Changing a board's config, cards included, needs
   `work.board.configure` on the project (project admins and org admins by default), or on the
   module for the org default board (org admins). "Edit WIP limits" covers WIP limits alone. A
   refusal is a `ForbiddenError` (403). No endpoint stores or reads a per-person card layout, and
   the board view takes none: unknown query keys are dropped.
3. **Display keeps what is personal.** Show empty columns stays personal, in the browser, with
   Reset. Its Cards section links admins to Board settings › Cards (`?tab=cards`) and tells
   everyone else that the layout is set by project admins. Group stays in the filter row and in
   the address.
4. **Quick filters are toggle chips in the filter row.** `QuickFilters` and `QuickFilterChip` in
   `@bemmoly/ui` draw one toggle per quick filter right after search, pressed (`aria-pressed`,
   the accent tint and a check) while it applies. Up to four sit in the row (two on a phone);
   the rest wait behind "+N more", a menu of checkboxes, and any that are on always show. They
   leave the Filter menu and are no longer applied chips. State stays in the `quick` parameter;
   Clear counts them. Board and Backlog share it through `IssueFilterBar`.

## Consequences

- An admin's card layout reaches every person at once; the settings preview and the board agree,
  including a board that hides the key or priority.
- Compact density is gone until it returns as a board setting, if people ask for it.
- The filter row is longer; on a phone it still scrolls sideways as before.

## Alternatives

- **Keep personal fields on top of the board's.** Rejected by the owner: the layout is a team
  decision.
- **Move density into board settings now.** Deferred: it needs the Cards tab, preview and diff
  to change and nobody asked for it yet.
- **Wrap the filter row onto two lines.** Rejected: the row is a fixed 46px in the frame;
  "+N more" keeps its height.
