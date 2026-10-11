# Settings › Integrations › Code hosts, and a project's Development settings

## Settings › Integrations › Code hosts (`/settings/code-hosts`)

- **Primary job.** Connect GitHub or GitLab so pull requests, branches and commits that name
  an issue key show on that issue, and see that deliveries arrive.
- **Top three actions.** Connect a code host (header, `?host=new`); send a test delivery from a
  host's card; open a host's recent deliveries (card menu, `?deliveries=<id>`).
- **Layout.** `contained`, in the new Integrations group of the settings sidebar. One card per
  host in a two-column grid that stacks on phones, built from the Sign-in method card: the
  host's mark, its name, a state pill (Receiving, No deliveries yet, Needs attention, Off),
  where it runs and how it calls the API, the last delivery in words, and its actions.
- **Dialog.** Connect and edit live in the address: `?host=new` (GitHub or GitLab),
  `new:<kind>` (the form), `<id>` (edit). Three numbered steps: add the webhook in the host
  (the payload URL and which events to send, shown once the host exists, so a connect moves
  straight to this step), where it runs (cloud or Enterprise Server / self-managed, and the
  webhook secret with Generate), and API access (a GitHub App or a token; the repositories
  backfill reads). Secrets are write-only: an empty field keeps the stored one.
- **Test delivery.** Signs a ping with the stored secret and sends it through the same path a
  real delivery takes, then makes one API call with the saved credentials. Both results show
  under the card, in words with a drawn mark, and the ping joins the delivery log.
- **Backfill.** In the card menu, enabled when the host has API credentials and repositories;
  it reads the last 30 days of pull or merge requests as a job, and a toast says it started.
- **Destructive.** Removing a host confirms: its links leave every issue and its secrets
  cannot come back. Turning a host off applies at once and refuses its deliveries.
- **States.** Skeleton while loading; with no host, one "Not connected" card per host with its
  Connect action; a refused signature shows on the card in red ("Needs attention") until a
  good delivery clears it; the delivery log has its own skeleton, empty and error states.
  People without `workspace.settings.manage` see who can change it.
- **Keys.** Tab order follows reading order; Esc closes a dialog.

## Project settings › Development (`/work/settings/<KEY>/development`)

- **Primary job.** Choose whether a linked pull request moves its issue.
- **Top actions.** Pick the status for "When a pull request opens"; pick it for "When a pull
  request merges". Each select saves on its own, optimistically, with a toast; a refusal puts
  the old value back.
- **Layout.** `contained`, a header tab beside Board. One card, two rows; on phones the select
  sits under its label.
- **Choices recorded.** These are simple project settings, not automation rules: the rules
  engine has not landed. A move goes through the workflow like any other; one the workflow
  does not allow from the issue's status is skipped, and the code host's delivery log says
  which issue stayed put and why. Drafts move nothing; "opens" includes reopening and marking
  a draft ready.

## Issue page › Development

- Placed after Links and before Activity, always shown like Links. Pull requests first, then
  branches, then commits (five, then "Show N more"), with group labels when more than one
  kind is present; the heading's hint counts pull requests by state ("1 open, 1 merged").
- Each row opens the host in a new tab; nothing is edited here, since code changes on the host.
- States: one skeleton row while loading; empty says how to link ("Name PLT-204 in a branch,
  pull request or commit to link it here."); an error says it did not load, with Try again.
  The list refreshes live when a delivery arrives (the delivery publishes the issue's
  realtime invalidation).
- The old Issue mock drew Development as a rail card with capitalised state pills; the system
  draws it as a body section of `CodeLinkRow`s with state icons and words.
