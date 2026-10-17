# Device sign-in (`/device`)

Where a command line tool such as `bp` sends the person to approve its sign-in (RFC 8628,
ADR 0046).

- **Primary job.** Confirm that the code in the terminal is yours, and let the tool sign in as
  you, or refuse.
- **Top three actions.** Continue with the code (primary button, Enter in the field); Approve
  sign-in (primary button); Deny (secondary button). "Not you?" signs out and comes back to the
  same address after the next sign-in.
- **Layout.** Standalone in `AuthShell`, like the consent screen: heading "Sign in on a
  device", a lede saying to check the code, then one step at a time: the code field, then an
  info note naming the device ("bp on build-box"), the tool, the modules it reaches, the 90 days
  and the code to compare, the person row, the two buttons and the small print about revoking
  in Settings › API tokens.
- **Keys.** Tab order follows reading order; Enter submits the code. Nothing from the frame.
- **States.**
  - Signed out: the guard sends the person to `/login?redirect=/device?code=…`.
  - Code field: accepts the code in any case, with or without the dash or a space; fewer or
    more than eight letters is an inline alert before anything is sent.
  - Looking up: two skeleton blocks, `aria-busy`.
  - Unknown, used or expired code: the error says so and what to do (start again on the
    device), with "Use another code".
  - Busy: the chosen button shows progress, both are disabled.
  - Approved: an info note "bp on build-box is signed in", back to the terminal, close the tab.
  - Denied: a neutral note "Sign-in refused", nothing more needed.
  - Phone: one column, full-bleed, `size="touch"` field and buttons.
- **URL state.** `code` fills the field and skips straight to the lookup (the tool's
  `verification_uri_complete`). Nothing else.
- **Choices recorded.** The person cannot narrow access here: the tool's module is fixed by
  the server for each first-party tool, and the token expires in 90 days. The code to compare
  is repeated in the note, because a code typed from someone else's message is how device
  sign-in gets phished.
