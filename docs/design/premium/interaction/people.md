# People: interaction notes

People is the suite's record of everyone at the company, inside Bemmoly's frame: a module
section in the sidebar (Directory, Org chart, Time off, Journeys) with the product switcher
above it, and Settings › People for its admin. The proposal (`docs/proposals/suite/people.html`
on the proposal branch) draws the target; where it and the design system differ, the system
wins (no second header row, no hand-drawn org canvas, no AI surfaces in this version).

## Directory (`/people`)

1. **Primary job**: find a colleague and see what is happening to them.
2. **Top actions**: search (the search field, `/` focuses it); filter by team or location
   (two `Select`s); open a person (click or Enter on a row). An HR admin's "Add person" in the
   header opens a dialog over the directory.
3. **Keys**: `/` search; arrows and Enter through the table rows (the `Table`'s own); `G` chords
   stay the shell's.
4. **States**: `TableSkeleton` while loading; empty workspace says nobody has a record yet and,
   for admins, offers Add person; a filtered empty list offers Clear filters; error is the
   warning `EmptyState` with Try again; hundreds of rows render in the one table (no virtual
   list until a workspace needs it); phone hides the manager and location columns.
5. **URL**: none in this version; filters reset on leaving.
6. **Choices**: "What's happening" is one badge per person (leaving, joining, away, away soon),
   the most useful one, as the proposal's column shows.

## Profile (`/people/p/:userId`)

1. **Primary job**: the one record of a person: employment facts, reporting line, company fields.
2. **Top actions**: Edit employment (admins with `workspace.people.manage`; a dialog that
   writes the kernel record); save company fields (the person, or `people.profiles.edit`);
   open their manager or a report (links).
3. **Keys**: Tab order through the fields; Mod+Enter saves the fields card.
4. **States**: skeleton cards; no record is the not-found `EmptyState`; a field the viewer may
   not see is not drawn at all; balances show only to the person, their managers and leave
   admins (the card is left out otherwise).
5. **URL**: the user id.
6. **Choices**: the proposal's "also held about them in other products" waits for those products.

## Org chart (`/people/org`)

1. **Primary job**: see who reports to whom, or who sits in a team, place or cost centre.
2. **Top actions**: switch the grouping (`SegmentedControl`: Reporting lines, Teams, Locations,
   Cost centres); fold and unfold a manager's reports; open a person.
3. **Keys**: the segmented control's arrows; Enter on a row opens the person.
4. **States**: skeleton rows; nobody yet is the directory's empty state; people who join soon
   carry a "Joins" badge, the proposal's dashed card drawn in the system's vocabulary.
5. **URL**: none.
6. **Choices**: an indented tree inside a `Card`, not a pannable canvas: the system has no canvas
   for people, and a tree reads at 390px.

## Time off (`/people/time-off`, `/calendar`, `/approvals`)

1. **Primary job**: ask for time off knowing the balance; for managers, decide knowing who else
   is away.
2. **Top actions**: Request time off (the header's primary button, or the Create menu's
   "Time off", which opens the same dialog at `/people/time-off/new`); withdraw a request
   (row button); approve or reject (Approvals tab).
3. **Keys**: the header tabs; in the dialog, Mod+Enter sends.
4. **States**: balances and lists skeleton; no policy yet tells the person to ask People; no
   requests is an empty row; the calendar with nobody away says so; approvals empty says nothing
   waits. Errors under the dialog's fields come from the server's validation.
5. **URL**: the tab (`/calendar`, `/approvals`), `new` for the dialog.
6. **Choices**: the day count in the dialog is computed with the server's own function
   (weekends left out); location holidays are a later step. The approval is the kernel engine's
   ("manager of requester"); People only shows it with the team's other absences beside it.

## Journeys (`/people/journeys`, `/people/journeys/:id`)

1. **Primary job**: get a joiner (or leaver) through every step, each with an owner and a date.
2. **Top actions**: tick a task (its checkbox); hand a task to someone else (journey admins);
   start a journey by hand (header button, admins).
3. **Keys**: Space on a focused checkbox; Tab between tasks.
4. **States**: skeleton; no journeys explains they start when someone joins or is leaving;
   tasks group by phase (before day one, day one, first week, later).
5. **URL**: the journey id.
6. **Choices**: phases are lanes of one list rather than the proposal's product swimlanes,
   which need the other products installed.

## Settings › People (`/settings/people/*`)

Header tabs: Locations, Cost centres, Levels, Leave, Journeys, Fields. Each is a `Table` with an
Add button opening a `Modal`; rows open the same dialog to edit. Locations and cost centres
write the kernel's org data (`workspace.people.manage`); fields are the kernel's custom fields
(`workspace.settings.manage`); the rest are People's own (`people.settings.manage`).
