---
'@bemmoly/core': minor
'@bemmoly/shared': minor
'@bemmoly/server': minor
'@bemmoly/api-client': minor
'@bemmoly/web': minor
---

Single sign-on and SCIM provisioning. Admins add identity providers in Settings › Sign-in and
SSO (or in the setup wizard): any OpenID Connect provider through its discovery URL, or SAML
2.0 with signed assertions. People are created on first sign-in with a default role, linked to
an existing account by verified email, and placed in roles and teams from their groups. A test
sign-in checks a provider without signing anyone in. "Require single sign-on for everyone"
turns password sign-in off except for break-glass admins; personal access tokens keep working
and are stopped by revoking them or deactivating the person. SCIM 2.0 at `/scim/v2` creates,
updates and deactivates people and keeps teams in step, with an audit row for every change.

Schema: changeset `0111-identity-sso` adds columns to `auth_providers` and the tables
`auth_sso_flows`, `auth_sso_assertions`, `scim_tokens` and `scim_resources` (reversible).
Configuration: no new keys. Identity providers on private networks are allowed; link-local
addresses are refused unless `BEMMOLY_ALLOW_PRIVATE_URLS` is set. Provider secrets are
encrypted with `BEMMOLY_SECRET_KEY`.
