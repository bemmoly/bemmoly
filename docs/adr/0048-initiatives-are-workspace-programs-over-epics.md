# ADR 0048: Initiatives are workspace programs over epics, read through the roadmap

- Status: accepted
- Date: 2026-10-21
- Changes: the Work data model in the tech design (§14), which stops at the epic, the top of
  a project's hierarchy; the roadmap's dependencies, which were epic-to-epic links only
- Evidence: customers running programs across several teams build one dashboard per program
  by hand, because nothing above an epic gathers work from more than one project

## Context

An epic lives in one project. A program ("New checkout") is several epics in several
projects (Platform, QA, DevOps), and what decides whether it lands is often a card in one team
waiting on a card in another. The roadmap already draws epics across projects with forecasts,
and issue links already carry "blocks" across projects; neither had a way to say "these epics
are one program", and the roadmap ignored links below the epic.

## Decision

1. **An initiative is a workspace row, not an issue type.** `initiatives` holds a name,
   description, owner, start and target dates, and `archived_at`; `initiative_epics` links it
   to epics in any project. Making it an issue level would put it in one project, which is the
   thing it must not be. An epic may belong to more than one initiative.
2. **Access follows the epics.** Anyone with Work reads initiatives; a new capability,
   `work.initiative.manage`, creates, edits, archives and links. An epic is linked only by
   someone who can open its project. Rolled-up numbers count only epics in projects the reader
   can open, and say how many more are hidden.
3. **The program view is the roadmap.** `GET /work/roadmap?initiative=<id>` returns the same
   `RoadmapView`, limited to the initiative's epics. Forecasts are computed over every epic of
   the projects in view, so a program epic still shares its team with the team's other work.
   One shape keeps the timeline, rescheduling and its optimistic cache identical on both
   screens.
4. **Dependencies lift issue links to their epics.** A "blocks" link between issues under two
   different epics is drawn, and forecast, as the first epic blocking the second, once per
   pair, with `via` (`epic` or `issue`), `links` (how many) and `conflict` (the waiting epic
   starts before its blocker ends). No new link table: the existing `issue_links` are the
   source.

## Consequences

- Programs need no hand-built dashboard; the initiative screen is a roadmap plus its rollup.
- Card-level links now move epic forecasts, which is what they always meant.
- Initiatives have no realtime channel yet (realtime is scoped by project); screens refetch on
  their own writes and on focus.
