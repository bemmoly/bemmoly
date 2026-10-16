---
'@bemmoly/core': minor
'@bemmoly/shared': minor
'@bemmoly/web': minor
'@bemmoly/api-client': minor
'@bemmoly/server': minor
---

Command line tools sign in with a device code: `bp login` shows a code, you approve it on
`/device` in a signed-in browser, and the tool receives an API token limited to its module
for 90 days, listed in Settings › API tokens. The OAuth metadata now advertises
`device_authorization_endpoint`. Schema: kernel changeset `0115-identity-oauth-device` adds
the `oauth_device_codes` table. No new configuration keys.
