---
'@bemmoly/module-work': patch
---

The Work board is now a working screen instead of a placeholder. A project's board shows its
columns mapped to statuses with counts and WIP limits, swimlanes, and cards laid out with the
board's card fields and colour rule; Scrum boards show the active sprint with its dates, goal
and velocity, Kanban boards show work in flight, cycle time and a throughput trend. Cards move
by drag and drop or from the keyboard (space picks a card up, the arrows carry it, space drops
it, Escape puts it back). A move into another column goes through the workflow, and a column
the workflow does not allow says why before the card is dropped; a move within a column
reorders it at once while the server confirms. The filter row adds people, epic, type and label
filters, quick filters, grouping, and an LQL bar that checks the query as it is typed and
suggests fields, operators and values. Cards open in a panel beside the board, and the board
updates live when someone else changes an issue. Long columns render in windows, so a 500-card
board stays responsive. No configuration or schema change.
