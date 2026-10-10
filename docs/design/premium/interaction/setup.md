# Setup wizard

The first-run wizard stays standalone (there is no workspace yet, so no app sidebar) but uses
the same tokens, icons, tiles and lockup as the app.

**Frame.** A 56px header with the Bemmoly lockup on the left and one muted chip on the right,
"Self-hosted · <version>", where the version is the one the page was built from (the web build
and the server ship as one image). The canvas holds a 200px stepper and a 640px column. On
phones the stepper becomes a one-line "Step n of 7" with a segmented progress bar.

**Steps.** Workspace, Your account, Import, People, AI, Look, Done. Workspace and account are
split so each fits above the fold at 1440×900; the account step creates the admin and the
workspace together, so nothing is written before both are answered. A workspace the server
refuses sends the admin back to step one.

**Stepper.** Circles in the status glyph's language: an empty ring ahead, a ring with a filled
centre for the current step, a filled accent circle with a tick once answered, and a dashed
ring at the muted text colour for a skipped step, so a tick always means "set". The colour is
the accent, not the success green: finishing a step is progress. Only the current step shows
its one-line description. Answered steps after the account can be revisited; the account and
the summary cannot.

**Welcome.** Step one opens with the 56px mark and "Welcome to Bemmoly". The six health
checks fold into one line ("Server healthy · Postgres 18, 38 GB free, backups nightly") with a
Details disclosure. A warning or failure opens the list on its own and says the fix in words
("Configure later in Settings › Email"); the wizard never links out of itself mid-flow.

**Footer and keys.** Back (ghost) on the left where the step before can still change, then
"Skip for now" where skipping is allowed, then the primary. Enter in a field, or with nothing
focused, sends the step; Enter on a button or a radio does that control's own action. Esc does
nothing destructive. The primary shows progress while saving and is never sent twice. A failed
save stays on the step with the message and Retry.

**Fields.** Every field validates on blur with its message under it; an empty field is not
flagged until the step is sent. The workspace step shows a live preview of the sidebar's
top-left as the name is typed. The password has a Show/Hide toggle inside the field and a
four-bar strength meter with a word; the meter guides, the 12-character rule decides.

**Look.** The eight presets are drawn as miniatures of the real Board. Picking one previews
the whole wizard in that theme. The brand colour sits inline (swatches and hex); using it
reveals mode and surfaces. Logo upload stays "Coming soon", but the row shows today's lockup
beside the custom-logo lockup, so admins see their logo leads and "on Bemmoly" stays.

**Done.** A launchpad: the summary ticks what was set and leaves skipped steps as dashed rings
with "Do it now" into the matching Settings page; three cards lead on (Create your first
project, or Turn on Work when Work is off; Invite people; Open Bemmoly). The primary is "Open
Bemmoly". The mark's four tiles settle into place once (about half a second, transform and
opacity only, no overshoot); under reduced motion the mark is simply there. Arriving marks
setup finished; the cached setup status is updated in place so the summary stays on screen.

**Resume.** The draft (never the password) lives in local storage, so leaving and coming back
resumes at the step that was left. Reaching the summary clears it.

**Choices recorded.** The Import row in the summary has no "Do it now": there is no import page
in Settings yet. Dark mode in the wizard comes from previewing a dark theme on the Look step;
before that the wizard follows the install's default theme.
