# ADR 0027: The MCP consent screen uses the sign-in shell

- Status: accepted
- Date: 2026-10-11
- Changes: the standalone screens in [layout.md](../design/system/layout.md) and the design
  system README ("the setup wizard and the pre-sign-in pages are the only standalone screens")
- Evidence: ADR 0026; the screen's interaction notes in
  `docs/design/premium/interaction/mcp-consent.md`

## Context

An MCP client sends the browser to `/oauth/authorize` to ask a person for access. The person
arrives from another app, often straight after signing in, and leaves again for that app as soon
as they decide. The frame (sidebar, header, Mod+K, bottom bar) would offer a dozen ways out of a
decision that has exactly two answers, and a screen in the frame cannot send the browser to
another site without looking like it navigated by accident.

## Decision

The consent screen is a recorded standalone screen. It uses `AuthShell` exactly as the pages
before sign-in do (ADR 0022): the form column with Bemmoly once, the product panel from 1100px,
`size="touch"` controls, and the workspace's look. It requires a signed-in person but not a
finished setup, and it never shows the frame.

## Consequences

- layout.md and the README name it beside the setup wizard and the pre-sign-in pages; the
  definition of done's frame line counts it as recorded.
- Nothing else that needs a session may sit outside the frame on the strength of this record.

## Alternatives

- **A page in the frame.** Rejected for the reasons above.
- **A dialog over the last page the person had open.** Rejected: the person usually has no page
  open; they come from the client.
