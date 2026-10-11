# MCP sign-in: the consent screen and Connected apps

## Consent screen (`/oauth/authorize`)

- **Primary job.** Decide, knowingly, whether an app may use this workspace as you, and how much.
- **Top three actions.** Connect the app (primary button, Enter on it; tap on phones); Deny
  (secondary button); narrow what it gets (the access radios and module checkboxes, Tab and
  Space; tap). "Not you?" signs out and comes back to the same request after the next sign-in.
- **Layout.** Standalone in `AuthShell` (ADR 0027): heading "Connect <app>", a lede naming the
  workspace, the app card (name, "Published by <host>", "Sends you back to <host>"), the
  loopback caution when the return address is on this computer, the person row, "What it can
  do", "Where", then the two buttons and the small print.
- **Keys.** Tab order follows reading order; no screen-specific keys and nothing from the frame
  (no Mod+K: the screen has two answers).
- **States.**
  - Loading: the heading at once, a card-sized skeleton and four text lines under it, `aria-busy`.
  - Signed out: the guard sends the person to `/login?redirect=<this request>`; single sign-on
    returns there too.
  - MCP off: a caution note saying an org admin turns it on in Settings › MCP; no buttons.
  - Untrusted app or return address (bad client id, unreadable document, unregistered
    redirect): a danger note with the reason and "start connecting again from your app"; never a
    button that leaves the page.
  - Malformed request from a known app (no PKCE, wrong response type, a resource that is not
    ours, no module open to the person): a danger note and "Back to <app>", which returns the
    error to the app's verified address.
  - Busy: the chosen button shows progress, both are disabled; the browser then leaves for the
    app.
  - No module chosen: the alert under "Where" and Connect disabled.
  - Phone: one column, full-bleed, `size="touch"` buttons; hosts wrap rather than truncate.
- **URL state.** The authorization request itself; the page reads the raw query so a numeric
  `state` is returned exactly as sent. Nothing else.
- **Choices recorded.**
  - Hosts are shown, not just the app's name: the document's host is what vouches for the name,
    and the return host is where the code goes (MCP spec, client metadata documents section 6).
  - The person may give less than asked (read only, fewer modules) but never more. A client that
    names no access scope may be given either; the default is what it asked for.
  - When every offered module stays ticked and the app named none, the connection covers every
    module the person can open, including ones turned on later, as "All modules" does for a
    personal token.
  - Consent is asked every time; nothing is remembered per app.

## Profile › Access tokens › Connected apps

- **Primary job.** See which apps act as you, and end one.
- **Top three actions.** Disconnect (the row's icon button, with a tooltip; a confirmation
  naming the app); read what each may do and where; see when it was last used.
- **Layout.** Below the personal tokens table on the same page: a section heading, one line on
  what these are, and the one table style (App with its host, Access, Modules, Last used, the
  action). Modules and Last used hide on phones.
- **States.** Table skeleton while loading; "No connected apps" with how one gets here; the
  settings failure with Try again; disconnecting shows progress in the confirmation and a toast.
- **Choices recorded.** Disconnect is a confirmation, not Undo: the app's tokens stop working at
  once on every device and cannot come back without signing in again.
