# ADR 0046: Command line tools sign in with a device code

- Status: accepted
- Date: 2026-10-17
- Builds on: [ADR 0026](0026-mcp-clients-sign-in-with-oauth.md) (the OAuth server for MCP
  clients)
- Interaction notes: [device-sign-in.md](../design/premium/interaction/device-sign-in.md)

## Context

`bp`, the Pipelines command line tool, needs to act as a person against the REST API from a
terminal, often over SSH on a machine with no browser. Until now the only way was a personal
API token pasted from Settings › API tokens. The kernel's OAuth server (ADR 0026) issues
tokens bound to the MCP server only; the REST API authenticates API tokens, not OAuth access
tokens.

## Decision

1. **The OAuth server gains the device authorization grant (RFC 8628)** for first-party tools
   only. `POST /oauth/device_authorization` (anonymous, form-encoded, rate-limited like the
   token endpoint) takes `client_id` and an optional `device_name`, and answers with a device
   code, an eight-letter user code from an alphabet without vowels or look-alikes
   (`WDJB-MJHT`), `/device` as the verification address, a ten-minute lifetime and a
   five-second interval. The metadata lists `device_authorization_endpoint` and the grant.
2. **Known clients only.** A fixed table in `services/oauth/device.ts` names each tool, its
   display name and the modules its token may reach (`bemmoly-pipelines-cli`: Pipelines).
   Any other client id is `invalid_client`; third-party apps keep the consent screen.
3. **The person approves on `/device`** in a signed-in browser (the consent screen's guard
   and shell), seeing the device name, the tool, the modules and the code to compare.
   Approve and deny are audited (`oauth.device_approved`, `oauth.device_denied`).
4. **The tool collects an API token, minted at collection.** Polling the token endpoint with
   `grant_type=urn:ietf:params:oauth:grant-type:device_code` answers `authorization_pending`,
   `slow_down` (polled faster than the interval, which then grows by five seconds),
   `access_denied`, `expired_token`, or the token once. The token is a personal API token
   (`bmy_…`), read and write, limited to the tool's modules, expiring in 90 days, named after
   the device and listed (and revocable) in Settings › API tokens. It is minted for the person
   who approved, inside the exchange, so the raw token is never stored and only an approval
   from a session can produce one. A second exchange of the same code is `invalid_grant`.
5. **Only hashes are stored.** The device code is kept as its sha256 (`oauth_device_codes`,
   kernel changeset `0115-identity-oauth-device`); expired rows are removed by the OAuth
   housekeeping job a day after they expire.

## Consequences

- `bp login` works on any machine; `bp login --token` remains for automation.
- An API token, not an OAuth access token, keeps one authentication path for the REST API.
  The trade is no refresh: after 90 days the person signs in again.
- Adding another first-party tool is one line in the client table.
