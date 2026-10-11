---
'@bemmoly/core': minor
'@bemmoly/shared': minor
'@bemmoly/api-client': minor
'@bemmoly/ui': minor
'@bemmoly/web': minor
---

Redesigned sign-in. Every page before sign-in has a form column and, on wide screens, a glimpse
of the product in the workspace's own theme and mode. Bemmoly appears once: its lockup leads
when there is no custom logo; with one, the customer's logo leads and "Powered by Bemmoly" sits
at the foot. Single sign-on comes first, with the provider this device used last marked and
focused; when single sign-on is required, admins kept as a fallback sign in at
`/login?method=password`. Errors say what happened: a wrong password marks the field, a rate
limit counts down, a deactivated account says who can turn it back on, a server that is down is
retried every 20 seconds without losing what was typed, and a refused single sign-on names the
provider. Signing out or an ended session says why and remembers the person on this device.
Forgot password carries the email over and offers a resend; reset names the account, takes one
password with a strength meter and signs in when saved; invitations accept through the provider
when single sign-on is set up. An admin whose setup is unfinished is welcomed on first sign-in
and can skip setup, with the remaining steps on Home. New: `PasswordInput` and a `touch` size in
`@bemmoly/ui`; setup status adds `theme` and `defaultMode`; `POST
/api/v1/auth/password-reset/preview`; completing a reset returns the user and a session; sign-in
refusals carry a `reason`. No schema or configuration change.
