---
'@bemmoly/core': minor
'@bemmoly/shared': minor
---

Add email and in-app notifications. Every email goes through an outbox that retries with
backoff and shows failures in plain words to admins; SMTP and a development `log` provider
are built in, with a test send that checks SPF and DMARC. Emails are themed from the
workspace brand colour and logo, say why they were sent, and carry a one-click unsubscribe
link. Notifications land in the inbox and follow each person's preference per kind: email at
once, a digest every few minutes or once a day, in-app only, or off.

Schema: changesets `0200-email-outbox`, `0201-notifications` and
`0202-notification-preferences` add `email_outbox`, `notifications`,
`notification_preferences` and `notification_schedules`. Settings: `email.provider`
(default `log`), `email.smtp.host`, `email.smtp.port`, `email.smtp.security`,
`email.smtp.username`, `email.smtp.password` (secret), `email.from`, `email.replyTo`,
`email.digestMinutes`.
