# Settings › Sign-in and SSO, sign-in page, setup SSO

## Settings › Sign-in and SSO (`/settings/authentication`)

- **Primary job.** See how people sign in and change it safely.
- **Top three actions.** Add an identity provider (header, `?provider=new`); test sign-in on a
  provider card; require single sign-on.
- **Layout.** `contained`. Method cards (password, then one per provider) in a two-column grid
  that stacks on phones; the sign-in policy card; the SCIM card with the one table.
- **Dialog.** Add and edit live in the address: `?provider=new` (preset picker),
  `new:<preset>` (form), `<id>` (edit). The form has three numbered steps: what to paste into
  the identity provider (shown once the provider exists), what the identity provider gave you,
  and who can sign in. Secrets are write-only: an empty field keeps the stored one.
- **Destructive.** Deleting a provider and revoking a SCIM token confirm (secrets cannot come
  back). Requiring SSO confirms and names who keeps a password; turning it off applies at once.
- **Break-glass admins.** Inside the policy card, every active org admin in a list: avatar,
  name, a "Break-glass" badge or "No password", the email (or why the action is unavailable),
  and "Make break-glass…" or "Remove…". Both confirm, naming the person and saying what changes
  for them and that every other org admin is told. "Remove…" is disabled, with the reason in the
  row, for the last one while single sign-on is required; "Make break-glass…" is disabled for an
  admin who signs in only with single sign-on. The server enforces both, and refuses demoting or
  deactivating the last one too. A toast confirms; the other admins get the `break_glass_changed`
  notice in the inbox and by email at once.
- **States.** Skeleton while loading; "Not set up" card with one action when there are no
  providers; the require switch is disabled with the reason until a test passes and a
  break-glass admin exists; people without `workspace.sso.configure` see who can change it.
- **Keys.** Tab order follows reading order; Esc closes the dialog.

## Sign-in page

- "Continue with SSO" (one provider) or "Continue with <name>" (several) above the password
  form, with the preset's mark. While SSO is required the password form folds behind "Sign in
  with a password (break-glass admins)".
- A sign-in that did not finish returns with `?sso_error=<reason>` and the page says what
  happened and what to do next, from a closed list of reasons.

## Setup › People

- The mock's two cards: the featured preset and "Another identity provider". Both open the same
  dialog as Settings; connected providers show as rows with their state. Testing and requiring
  SSO stay in Settings.
