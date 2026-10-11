# ADR 0026: MCP clients sign in with OAuth, identified by client metadata documents

- Status: accepted
- Date: 2026-10-11
- Changes: tech design §10 ("Personal API tokens with scopes for scripts and the MCP server") and
  §9 (`/mcp` "under a personal token")
- Evidence: the MCP authorization spec, 2025-11-25 (`basic/authorization`)

## Context

The built-in MCP server accepted personal access tokens only, so connecting a desktop AI app
meant creating a token, copying it into a JSON file and keeping it there for 90 days or forever.
The MCP authorization spec defines how a client signs in instead: protected resource metadata
(RFC 9728) that names the authorization server, authorization server metadata (RFC 8414), the
authorization code flow with PKCE, the `resource` parameter (RFC 8707), and three ways for a
client to be known: pre-registration, client ID metadata documents ("SHOULD") and dynamic client
registration ("MAY", kept "for backwards compatibility").

## Decision

1. **Bemmoly is its own authorization server for `/mcp`.** Metadata at
   `/.well-known/oauth-authorization-server`, protected resource metadata at
   `/.well-known/oauth-protected-resource/mcp[/<module>]`, named in every 401's
   `WWW-Authenticate`. Endpoints: `/oauth/authorize` (the consent screen, a web route), and
   `/oauth/token` and `/oauth/revoke` (RFC 7009).
2. **Clients are known by client ID metadata documents, not dynamic registration.** The client
   id is the https address of a JSON document naming the app and its redirect URIs; the server
   fetches it when a signed-in person opens the consent screen (never anonymously), through the
   address-checked client (public addresses only unless `BEMMOLY_ALLOW_PRIVATE_URLS`, no
   redirects, five seconds, 16 KB), and caches it for five minutes to a day. There is no
   registration endpoint, so nobody can create clients anonymously. Every client is public:
   `token_endpoint_auth_methods_supported` is `["none"]`.
3. **PKCE with S256 only; redirects are https or loopback.** A redirect must match the document
   exactly, except that a loopback redirect may use any port (RFC 8252 7.3). A request whose
   client or redirect cannot be trusted is shown on the page and never redirected anywhere;
   other errors go back to the verified redirect with `iss` (RFC 9207).
4. **The person decides on a consent screen, after the normal sign-in.** Password or single
   sign-on, then back to the same request. It shows the app, the host that vouches for it and the
   host it sends them back to (with a caution for loopback), and the person picks read only or
   read and write and the modules, never more than the app asked for. Approvals and denials are
   audited.
5. **Short-lived, bound, rotated tokens.** Access tokens last an hour and are bound to the MCP
   address they were issued for (`/mcp` covers `/mcp/<module>`, not the other way round). Refresh
   tokens last 30 days and rotate on every use; presenting a used refresh token or a used code
   revokes the whole connection. Both are stored as sha256 only. A connection (grant) is listed
   under Profile › Access tokens › Connected apps and revoked there; deactivating a person ends
   their connections. OAuth access tokens are refused by `/api/v1`.

## Consequences

- Four tables (`oauth_clients`, `oauth_authorization_codes`, `oauth_grants`, `oauth_tokens`) in
  changeset `0112-identity-oauth`, swept by housekeeping.
- A per-address budget for discovery, token and revocation requests
  (`BEMMOLY_RATE_LIMIT_OAUTH_PER_IP`, 60 a minute) and a per-person one for consent previews (30 a
  minute), since a preview may fetch a document.
- Clients that only do dynamic registration cannot sign in; they use a personal access token as
  before. Personal access tokens keep working everywhere.
- The consent screen sits outside the frame, in the sign-in shell (ADR 0027).

## Alternatives

- **Dynamic client registration.** Rejected for now: the spec makes it optional, and it is an
  anonymous endpoint that creates rows. It can be added behind a setting if a client needs it.
- **An external identity provider as the authorization server.** Rejected: the SSO provider
  knows nothing about Bemmoly's modules or capabilities, and installs without SSO need sign-in too.
- **JWT access tokens.** Rejected: opaque tokens are revocable at once and need no key rotation;
  the MCP server is the only resource server.
