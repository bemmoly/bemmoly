---
'@bemmoly/core': patch
'@bemmoly/shared': patch
'@bemmoly/api-client': patch
'@bemmoly/web': patch
---

People you invite join as Viewer, the least-privileged role, unless you pick another role:
in the setup wizard, in Users › Invite people, for a new team's default role and through the
API, where `roleId` is now optional on `POST /api/v1/invitations`. Invited people now appear
in Users as INVITED rows and count as invited, with Resend, Copy invite link and Revoke.
After sending invitations, Bemmoly shows each person's sign-up link to copy and share, and
says so plainly when outbound email is not set up yet; Copy invite link issues a fresh link
later (the old one stops working). Invitation and password reset emails now link to pages
that exist (`/accept-invitation` and `/reset-password`); links sent by earlier versions open
a missing page, so resend those invitations or copy a new link. No configuration or schema
change.
