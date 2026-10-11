# ADR 0030: Modules own an org defaults page in Settings

- Status: accepted
- Date: 2026-10-11
- Changes: [ADR 0023](0023-card-layout-is-the-boards-quick-filters-in-the-row.md) point 2 (the org
  default board was writable with "Configure board" on the module) and the module settings rows
  of `docs/design/system/layout.md` (a module's row opened Settings › Modules unless it added
  `settings` navigation entries, whose page was a stub); and
  [ADR 0029](0029-cards-draw-exactly-the-boards-fields.md) decision 6, which becomes a fallback:
  the org default board is now seeded, so Work's own default board is compared with only should
  it be missing, as the server's inherited board falls back the same way
- Evidence: owner feedback on 0.11.0: project Settings › Board says "Based on the org default"
  and the server keeps org default issue types, fields, workflows and boards, but nothing in the
  product changes them

## Context

Work's schemes have had an org default since the first release (tech design §14): issue types,
fields, the workflow and the board, each copied into a project only when the project overrides
it. The project settings pages compare a project with its default and reset to it, but the
default itself could only be changed through the API. Settings › Modules › Work opened the
manage-modules page; the generic module settings page said "Nothing to configure here yet".

Three gaps sat behind that. The shell had no way for a module to draw its own pages in
Settings. The org default board was a copy every project held, so a change to it reached no
project. And the server let anyone holding "Configure project" or "Configure board" on the
module write the defaults: by default that is org admins, but a workspace role such as Project
admin holds both, and a change there reaches every other project.

## Decision

1. **A module declares its settings in its manifest.** `defineModule({ settings: { path,
   requires } })`, with `path` exactly `/settings/<module id>` (checked at boot) and `requires`
   `admin` by default or a capability name. The manifest carries it to the web shell, which lists
   one row under Settings › Modules, headed by the module's tile and name, for the people
   `requires` admits. Settings › Modules › Manage modules keeps turning modules on and off. A
   module without `settings` keeps its row into Manage modules.
2. **The module draws the pages.** Its web entry `web/src/settings.tsx` (found by folder, as
   `sidebar.tsx` and `create.tsx` are) receives the trail "Settings / Modules / <Module>" and the
   subpath, and renders its own `PageLayout`: header tabs for its sections, `contained` for lists
   and `full` for editors, inside the one frame. The settings layout steps aside under that path.
   The entry loads on its own, never with the module's screens. Docs can register the same way.
3. **Work's page is the project settings pages in the org scope.** Settings › Work has the tabs
   Issue types, Fields, Workflow and Board (Columns, Swimlanes, Quick filters, Cards, Sprints and
   estimation). The pages take a `scope` (`org` or a project) instead of being copied. Each says
   which projects the default reaches: "Used by 12 projects; 2 have their own version (PLT,
   OPS) and keep them. Changes here reach the other 10." (`GET /api/v1/work/schemes`). The
   method is each project's own, so the org Board page sets sprint length, working days and
   estimation, not Scrum or Kanban.
4. **Only workspace admins change the org defaults.** Every write to an org default issue type,
   field, workflow or board needs a workspace admin, whatever capability the person holds on the
   module; anyone else gets a `ForbiddenError` (403). Reading stays "View issues".
5. **A change to the org default board reaches the projects that follow it.** A project follows
   while it has no board override mark and its board matches what it inherits. Before a change to
   the org default board (create, update, delete) the server lists the followers; after it, each
   follower's board takes the config it now inherits, in the same transaction, and its open
   boards refetch. A project that changed its board, or overrode it, keeps its own. Issue types,
   fields and the workflow already reach followers because they read the org rows.
6. **Reset to default returns a project to following.** A project's Board settings reset goes
   through `POST …/schemes/board/reset`, which puts back the inherited config and drops the
   override mark, so later default changes reach it again. Resetting the board needs "Configure
   board", as every other board change does. The "Based on" note links workspace admins to the
   matching org page ("Edit org default").
7. **The org default board always exists.** Nothing made one before, so project settings
   compared a board with nothing. The changeset `0026-work-default-board` seeds "Workspace board"
   from the org default workflow (one column per open status, one Done column), on new installs
   and existing ones alike; for a project on the default workflow it is the board the project
   already has, so no project stops following. Should it be deleted, `GET /work/boards` makes it
   again on its next read, as a project's first read makes its board.
8. **"Its own version" means the project's copy is not the default.** Every project holds a full
   copy of the board, so a project has its own board when its copy differs from what it
   inherits, or when it overrode the board on purpose (the mark, which the override dialog
   says stops later changes reaching it). The usage counts and the followers use the same rule.

## Consequences

- An admin changes the defaults where the product says they live, and sees who a change reaches
  before making it; the review dialog says that projects with their own board keep it.
- A Project admin workspace role can no longer edit the org defaults. Nobody held that on purpose:
  the defaults were not reachable from the UI.
- One seed changeset (`0026-work-default-board`), reversible: its down removes the seeded board.
- Saving the org default board touches every following project's board in one transaction; with
  hundreds of projects the save takes longer. It is rare and admin-only.
- Publishing the org default workflow does not yet rewrite following boards' columns for added or
  removed statuses; that stays as it was (columns keep their statuses; Board settings lists the
  rest as "Not on the board").

## Alternatives

- **A project without an override stores no board and reads the default live.** Cleaner, but
  every board read, view, metric and realtime scope keys on the project's board id; changing that
  is a larger migration than carrying changes to followers.
- **Separate org pages written for Settings.** Rejected: two copies of every editor drift apart;
  the scope prop keeps one.
- **Module settings as navigation entries with a kernel-drawn page.** Rejected: the kernel cannot
  draw a module's editors, and entries could not choose a layout or tabs.
