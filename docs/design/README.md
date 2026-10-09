# Design mocks

`mocks/` holds the 17 product screens that are the pixel source of truth for Bemmoly.
Open `mocks/Bemmoly App.dc.html` in a browser; it links to every other screen. Under
"Configuration and admin" it includes the three System settings screens:
`Bemmoly Modules Settings.dc.html`, `Bemmoly Updates Settings.dc.html` and
`Bemmoly Backups Settings.dc.html`.
Each file is self-contained HTML plus `support.js`; the data behind a screen lives in a
`class Component extends DCLogic` block near the end of the file.

`mocks-export.zip` is the original export. The extracted files are what the code is built from.
Every mock carries the designed Bemmoly mark in place of the export's placeholder logo.

Changes the tech design has queued for the mocks (the design is otherwise followed exactly):

- Settings › AI and models: the catalog status line ("Live · models.dev · updated 4 minutes ago")
  and the catalog upload control. There is no AI settings mock yet; the wizard's AI step shows
  the status line pattern to follow.

Setup wizard changes the owner asked for on 2026-10-08, built in code first and to be folded back
into `Bemmoly Setup.dc.html`:

- Step 1: the admin form is two labelled groups, "Workspace" (name, URL) and "Your account"
  (name, email, password), one field per row with a one-line description under each group label,
  instead of the two-column grid. The URL field is recessed and carries a hint saying it was
  filled from the browser address.
- Step 2: the three importer cards show a neutral COMING SOON badge and cannot be selected until
  importers ship; "Start clean" is pre-selected and the primary reads "Continue" rather than
  "Start import in background". The notice text is new.
- Step 3: the sign-on cards show COMING SOON with no connect buttons and no RECOMMENDED badge,
  so they are shorter than in the mock. The "Or invite by email" card is a proper section with a
  heading and a defaults line; the delivery note sits under the role and team pickers.
- Option tiles on the import, sign-on and provider cards and in the provider list show logos
  (models.dev provider marks, simple-icons import marks, Google's sign-in "G") or design-system
  glyphs instead of initials. Initials remain the fallback.
- Step 5 and Settings › Appearance: clicking a theme tile previews that theme on the whole page
  at once; Save or Finish makes it permanent, Back, Skip or Discard reverts it. The mocks show no
  state for this.
- Step 6: skipped rows (import, AI, theme) show an empty circle and lighter text; the mock shows
  only the case where every step was set.
- The rail note drops its second sentence and reads only "Everything here can be changed later
  in Workspace settings."
- Default look: before a workspace theme exists the app renders Classic light regardless of the
  OS setting; there is no "follow the OS" choice any more. Whether the user menu should offer a
  "Match system" entry is open.

Changes from the owner's hands-on test of 0.1.1 (2026-10-08), shipped in 0.1.2 and 0.1.3, to be
folded back into the mocks:

- Setup step 5: "Build a custom theme with your brand color instead" is a toggle that opens the
  Custom theme card from the Appearance Settings mock under the tiles, previewed on the whole
  page; it reads "Use a preset instead" while open and no tile is selected then.
- Option tiles: logos are drawn in full colour, provider marks in the primary text colour on the
  chip, import marks in their brand colour (adjusted to at least 3:1 on dark presets), the
  Google G in its own colours. Coming-soon cards fade as a whole at 60% with the badge at full
  strength. Settings stay closed until setup is finished.
- Dropdowns: every select is one custom listbox. Open state (not in any mock): the Doc Editor
  menu surface with a search row, a tick on the chosen option, a "Showing 50 of N · type to
  narrow" footer, "No matches" and "Searching…" lines. Person options show the email as a
  second line. Chevrons are 16px Lucide ChevronDown (14px in small controls), tx4 at rest and
  tx when open, replacing the 10px ▾.
- Menus render in a floating layer, so they are never clipped by a card; width fits content
  between 180 and 320px.
- Icons: Lucide at 16/18/14px with a 1.5px stroke behind the existing names. Top bar: Inbox is a
  tray, Theme a sun-and-moon, carets only on items that open a menu, Create opens a menu with
  icon, label and description, or an empty state pointing admins to Settings › Modules.
- Settings sections (Storage and backups, Updates, Email, Workspace details, Authentication):
  read view of label/value rows with an Edit button per section; editing adds an "Editing" tag,
  outlined card and Cancel/Save footer; dangerous changes open a confirmation dialog, some with
  a typed word; a sticky unsaved-changes bar guards navigation. Email and Workspace details have
  no mock yet and follow the same pattern.
- Storage and backups: Restore… replaces "Restore drill" in the header and leads every row; the
  Verification column moves after the actions; the table scrolls sideways when narrow; the
  restore confirmation asks to type `restore`.
- Modules Settings: Enable opens "Who can use <Module>?" with Nobody yet (recommended), Everyone
  and Specific teams with a team picker, and the sentence about Users › Module access. The
  "Default access" column is gone. A fresh install starts with nothing enabled.
- People: INVITED rows with an amber badge and "Invited <time>", a "Copy invite link" row
  action, the "Invitations sent" panel with the no-email notice (also on the setup People step),
  and the Accept invitation page names the inviter. Viewer is the default role everywhere.

Work module 0.2.0: deviations the Work screens shipped with, to be folded back into the mocks.

Issue (`Bemmoly Issue.dc.html`), the page and the slide-over:

- Attach and Link doc are not on the action row, and the Docs and Development cards and the
  Reviewers row are absent: attachments, the Docs module and code integrations are not in this
  release.
- Acceptance criteria render as their own section from the type's field, not inside the
  description.
- Details values are edited in place: labels show a remove ×, and Watch reads "Watching" when
  on.
- Relative times use the shared formatter ("3h ago", not "3 hours ago").
- In the slide-over, subtask rows keep the page's 13px rows and Linked issues show too.
- The create issue form, the project list and the create project dialog have no mock; they are
  built from the Modal, FormGrid, Field, Table and SelectableCard patterns.
- The create project dialog takes the owning team and shows that team's lead: a project stores
  no lead of its own.

Workflow (`Bemmoly Workflow.dc.html`):

- The subtitle ("Applies to Story, Bug, Task · …") is replaced by the published version, the
  count of unpublished changes and the save state: there is no per-type workflow assignment to
  show.
- Rule chips (C, V, P with a count) sit on the selected transition's label only; at rest the
  labels keep the mock's width.
- "Who can move issues here" and the average time in status are not shown. The status panel adds
  name, category and colour fields and a delete link, which the mock does not draw.
- An edge between nodes on different rows leaves the side facing its target and enters the
  target's facing side; the mock's one such curve enters In progress from the top.
- The project settings sidebar is drawn with Workflow current and its other items inert, and the
  logo tile is the accent fill, not the mock's gradient.
- The workflows list is new; the mock has no list screen.

Board settings (`Bemmoly Board Settings.dc.html`):

- The header has no "Save changes": each tab saves on its own through the read-then-edit pattern
  (Edit, then Cancel and Review and save under the tab). "+ Add column" and the remove × show
  while Columns is being edited.
- A Quick filters tab sits between Swimlanes and Cards, reusing the Custom lanes card.
- The Permissions tab is not built; capabilities and org locks are edited in Workspace › Roles
  and permissions.
- Card color gains a Color rules section (an LQL condition and a colour) under the four presets;
  the preview card shows the first valid rule's colour.
- "+ Add custom field to cards" is not shown: whether a custom field is on cards is set per issue
  type.
- Sprints has no "Starts on" control: the board stores no start day.
- The sidebar lists only the pages that exist (Issue types, Fields, Workflow, Board), and its
  footer says whether the person can change the settings instead of naming a role.
- The Issue types and Fields pages have no mock; they are the settings frame, the scheme banner
  and SettingsSection rows.
- Unmapped statuses are grey whatever their category, as in the mock; mapped statuses take their
  own colour or their category's.
- Leaving with an unsaved draft, from the sidebar, the top bar or Back, shows the unsaved-changes
  bar in its leaving state.

Backlog (`Bemmoly Backlog.dc.html`):

- There is no AI tip row under the active sprint, no doc links on rows and no Insights button;
  the project switcher sits where Insights was.
- The project sidebar lists only Backlog and Board, and its tile is the solid accent, not the
  mock's gradient.
- Epic meta reads "9 issues · 3 done" or "not started" rather than a due date, which epic
  progress does not carry.
- Epic colours run accent, violet, sky, orange, then the other hues in panel order; the mock's
  teal is not a token.
- A planned sprint shows the CapacityBar ("19 of 22 pts capacity"), not the "~22" text alone.
- The Backlog container has no ··· button.
- A row's status badge names the board column that holds the status ("In review" for Code
  review), coloured by the column's place among the in-progress columns.
- The signed-in person's avatar wears the accent and everyone else's hue comes from their id, so
  the colours differ from the mock's fixed table.

Board (`Bemmoly Board.dc.html`):

- The project sidebar is not part of the board, which takes its 240px.
- The AI "Sprint risk" and "Flow risk" banner, the Insights button and Kanban's "Release" are
  left out; "Complete sprint" moves to the Backlog, where sprints are closed.
- The column "+" for adding an issue to a column is not shown yet.
- The LQL bar has no mock: it opens from an LQL chip at the end of "Search this board", widens to
  420px, and shows problems and suggestions in a floating panel built from the menu surface.
- The refused-column state has no mock: the cell takes the dashed drop frame in the warn pair
  with the reason inside, and the drop indicator is a 2px accent line in the cell's gap.
- Kanban age uses the mock's 4-day "slow" threshold.
- Saved filters have no mock: a "Saved filters" menu (Mine, Shared with me, then Save current
  filter and Rename or delete) sits after the search box, and a "Save filter" button joins it
  while an unsaved LQL query is applied. With the LQL bar open at 1440px, "Group by" wraps to a
  second row.

Rich text, in descriptions, document fields and comments:

- Descriptions are edited in the composer's box (br3 border, 7px radius, 10px 12px padding) with
  the tool row and Cancel and Save under the text; the Issue mock shows only the read view.
- The description tool row adds Heading, List, Numbered, Checklist, Quote and Code block to the
  composer's B, I, @, Link and Code.
- Typing "/" opens a Blocks menu drawn from the Doc Editor mock's slash menu, and the @ and #
  lists use the same menu look.
- "Draft reply with AI" is not shown on the composer.
- The Issue mock has no dark version, so the editor in dark is checked against the theme tokens
  only.

Domains: the product site is bemmoly.com, the installer one-liner is served from get.bemmoly.com, and release manifests are GitHub release assets.
