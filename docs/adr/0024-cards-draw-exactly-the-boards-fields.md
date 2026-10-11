# ADR 0024: Cards draw exactly the board's card fields

- Status: accepted
- Date: 2026-10-11
- Changes: decision 1 of [ADR 0023](0023-card-layout-is-the-boards-quick-filters-in-the-row.md)
  ("plus the time in column on Kanban")
- Evidence: owner report on 0.11.0, reproduced on a real install

## Context

ADR 0023 made the card layout the board's, set in Project settings › Board › Cards. On a real
install nothing the owner changed there showed on the board. The settings were saved and the
board view returned them; the cards did not follow them:

- The card mapped only some fields. Issue type always showed. Due date, reporter and created
  date had no place on the card at all. Linked docs were never filled in by the server.
- On Kanban the card dropped Estimate whatever the setting, and always added the time in
  column ("0d") and the done tick, which no setting controlled.
- The order the Cards tab lets admins drag was ignored.
- "By epic" painted every card grey unless the lanes were epics, because the epic colours came
  from the lanes.
- The page compared the board with the org default board scheme, which no install has unless an
  admin makes one, so "Based on the org default, with no changes yet" never changed and Reset
  stayed off.

Imported issues often have no labels, assignee or estimate, so the few fields that were wired
showed nothing either, which made the layout look ignored end to end.

## Decision

1. **A card draws exactly the board's `cardFields`, in their order, and nothing else.** Every
   card field has a place on `IssueCard`: type, key, priority, labels, estimate, assignee,
   linked docs, blocked, due date (red once overdue, never on a done card), subtask progress,
   reporter, created date and time in column. Scrum and Kanban draw the same fields. A field
   shows on a card only when its issue has a value; an unassigned card with Assignee on shows
   the empty ring.
2. **Time in column is a card field (`age`, "Time in column")**, off unless a board turns it on.
   Its done tick stays for cards in a done column.
3. **Order applies within each side of the footer**: the identifying parts on the left (type,
   key, linked doc, subtasks, due, created) and the sizing and people on the right (priority,
   estimate, time in column, reporter, assignee). Blocked stays the chip above the title and
   labels stay their own row.
4. **The view carries what the card needs**: each card's reporter, created day and epic, the
   epics' keys and colours whatever the lanes, and linked docs through the kernel's
   `links.referencesToMany`, asked once per board and only while the board shows linked docs.
5. **The Cards tab preview is the board's own card**, drawn through the same mapping, with a
   second sample issue that has no optional values.
6. **Board settings compare with Work's default board** when the org has no board scheme: the
   board a project starts from, so the note counts real changes and Reset puts it back.

## Consequences

- Existing Kanban boards stop showing the time in column until an admin turns it on.
- Rolling back to 0.11.0 after turning on Time in column shows that board as two empty columns
  until the field is turned off; stored configs are now read leniently, so later versions drop
  card fields they do not know instead.
- A board that shows linked docs costs one more call per refetch, answered in one statement.

## Alternatives

- **Drop the time in column from cards.** Rejected: on Kanban it is the signal of stuck work;
  a setting keeps it for the boards that want it.
- **Store the time in column as its own flag beside `cardFields`.** Rejected: it would be the one
  field the Cards list could not order or diff like the others.
