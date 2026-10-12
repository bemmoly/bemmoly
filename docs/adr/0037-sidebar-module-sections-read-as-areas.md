# ADR 0037: The sidebar's module sections read as areas, and the current one is marked

- Status: accepted
- Date: 2026-10-12
- Changes: the module section rules in [layout.md](../design/system/layout.md#module-sidebar-contributions)
  and the `SidebarHeading` entry in [components.md](../design/system/components.md), which drew
  a module's heading as an 11px muted caption and its fixed links after its live rows
- Evidence: a workspace with one project and one space, where Work and Docs read as captions
  between rows of the same weight, "All projects" and "Roadmap" read as rows of the last project,
  and nothing changed when the address moved from Work to Docs

## Context

The sidebar's sections are the product's areas: Work and Docs today, more modules later. Their
headings were quieter than every row under them (11px, the muted ink, a 14px tile), the personal
rows (Home, Inbox, My issues) ran straight into the first module, and one module ran straight
into the next. A module's links to the whole area (All projects, Roadmap, Docs home) came after
its projects or spaces, so they read as part of the last one. And the sidebar never said which
area the address was in: only the row was current.

## Decision

1. **A module's heading is its header row.** With a tile, `SidebarHeading` draws a 32px row: the
   module's tile at 20px, its name at 13px semibold in `tx-2`, and `tx` when it is the current
   module. Without a tile it stays the 11px caption (Settings' groups).
2. **The current module is marked.** `SidebarSection` wraps each module's section, inset 4px
   with the card radius; the one the address is under (`/<module id>`, except the rows it lends
   the top of the sidebar, such as My issues) sits on `bg-acc/6` with a `ring-acc/15` hairline,
   and its heading's "+" stays shown. The rail draws no wash.
3. **Order within a section**: the header row, the module's links to the whole area, then a
   `SidebarLabel` ("Projects", "Spaces", 11px muted) over the live rows. Docs home moves from
   after the spaces to the top of Docs.
4. **A rule** (`border-line`) separates the personal rows from the modules; sections sit 10px
   apart.

## Consequences

- A person sees which area they are in without reading the current row, and the area-wide links
  read as the area's.
- The section is a little taller: the header row is 12px taller than the caption and each list
  adds a 20px label.
- The wash uses the accent at low opacity, so every preset and mode carries it without a new
  token.
- The Appearance page's preview draws the same sections.

## Alternatives

- **Only a bolder heading, no wash.** Fixes the reading of the heading but still never says
  which area you are in.
- **A divider between modules only.** Separates the areas but leaves the headings as captions.
- **A coloured bar at the section's left edge.** Reads as a selection on one row, and competes
  with the child rows' guide line.
