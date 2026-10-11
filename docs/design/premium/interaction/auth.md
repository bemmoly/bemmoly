# Sign-in and the pages before it

Sign-in, single sign-on, the admin fallback, forgot and reset password, invitations and the
first-sign-in welcome. All of them sit in `AuthShell` (ADR 0022): a form column and, from
1100px, the product panel. Evidence: `docs/design-review/bemmoly-signin-review.html`.

## Brand

Bemmoly appears exactly once. No custom logo: the lockup top-left and the workspace name in the
heading. Custom logo: the customer's logo and name top-left, "Powered by Bemmoly" at the foot.
The foot shows only the lock and the host besides.

## Sign in (`/login`)

- **Job:** get back into the workspace. **Top actions:** continue with the provider, sign in
  with email and password, forgot password.
- **Keys:** Enter submits (the hint sits in the button); Tab order is providers, email,
  password, show password, forgot, submit. Focus lands on the remembered provider, else the
  only provider when single sign-on is required, else the email field (the password when the
  email is known).
- **Single sign-on first:** "Continue with {provider}" buttons with each provider's own mark and
  its full name (wrapping on phones, never truncated), "Last used" on the one this device used
  before, then "or with email". The first provider is the page's primary action: the accent
  fill, with a full-colour mark on a white chip (a one-colour mark takes the accent on the
  button's ink). Further providers are secondary, and so is the password submit below them;
  without single sign-on the password submit is primary. With single sign-on required, the
  password form is gone: the filled button and "Admin without single sign-on? Use a password"
  (`?method=password`, the admin fallback, without "Forgot password?"). No helper line about
  where the password lives.
- **Remembered method:** `localStorage["bemmoly.last-sign-in"]` holds the method, provider,
  email and name, on this device only. No email-domain routing.
- **States:**
  - pending: fields read-only, the button busy at full contrast; from 4s "Taking longer than
    usual… still trying."; at 15s it gives up as below, keeping what was typed;
  - signed in: a short beat ("Signed in, opening Acme Labs…") before the app;
  - wrong password: a field error under the password, which is selected;
  - rate limited: a caution note and the button counting down from the server's Retry-After;
  - deactivated: no form, a note saying an admin turned the account off and can turn it back
    on in Settings › People, and "Use a different account";
  - server down or timed out: a note, "Try again now", and a retry every 20 seconds that
    signs in once the server answers, with the form dimmed but kept;
  - single sign-on refused: a note naming the provider tried, the reason, and "Try {provider}
    again";
  - session ended (`?reason=expired`) and signed out (`?reason=signed-out`): the reason, then the
    remembered person with "Not you?" and only the password (or their provider).
- **Live regions:** failures are `alert`; waits, sign-outs and the slow line are `status`;
  field errors are announced and joined to the field with `aria-describedby`.

## Forgot and reset password

- Forgot carries the email over from sign-in, says the link works for an hour without saying
  whether the account exists, and offers "Resend link" after 60 seconds. With single sign-on,
  a line says to reset the password with the provider.
- Reset names the account ("For rohan@acmelabs.dev"), takes one field (show or hide instead of
  typing it twice) with a strength meter, and "Save password and sign in" really signs in. A
  dead link says so with "Email me a new link".

## Accept invitation

- The inviter, the role and the team on the accent wash. With single sign-on set up the
  invitation is accepted through the provider only; otherwise the email is fixed (locked), then
  name and password.

## First sign-in welcome (`/setup?welcome=true`)

- **Job:** an admin with setup unfinished picks up where they left it, or skips it.
- The steps with done, skipped and next marks; Continue on the next one (focused); "Skip setup
  and open {workspace}" opens the app on this device, and Home lists what is left.

## Follow-up: two-step verification

Designed in the review (code entry, recovery codes, "Trust this browser for 30 days"), not
built. It needs identity tables and an ADR first; when single sign-on is required it should be
mandatory for the admin fallback accounts.

## The product panel

From 1100px the right-hand panel shows a still life of Bemmoly in the workspace's theme, one
card per part of the product: a board, the sprint's progress, the Inbox with an @mention, a
Docs page being edited (a heading and real text), the backlog, an AI summary labelled
"Example", and the ⌘K chip. Cards sit in two loose columns with gutters and do not cover each
other. The drawing scales to fit but never past 92%, so its text stays at product sizes (11
to 13px) on large screens; narrow panels (1100 to 1300px windows) drop the backlog. It is
hidden from assistive tech, hidden below 1100px, and its drift stops under reduced motion.
