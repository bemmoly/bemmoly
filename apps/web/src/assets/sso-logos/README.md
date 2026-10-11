# Sign-in logos

The marks shown beside single sign-on presets, in Setup, Settings › Sign-in and SSO and on the
sign-in page's "Continue with …" buttons. Each file is named after the `logo` field of a preset
in `src/data/sso-presets.json`; code finds them by that name (`src/lib/sso-logos.ts`) and never
names a provider itself. A preset without a file shows the neutral key glyph.

`google-g.svg` is the multicolour "G". It is drawn as an image, in its own colours, because the
sign-in guidelines ask for the mark unaltered. The other files are one-colour marks, painted in
the text colour through a mask.

## Source

- Downloaded from Google's hosted sign-in assets:
  `https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg`
- Fetched on 2026-10-08. The editor metadata, ids, group transforms and the empty bounding
  path were removed; the four coloured paths and the copyright line are unchanged.

`microsoft.svg` is the four-square Microsoft mark for Entra ID, drawn as an image in its own
colours as Microsoft's sign-in branding guidance asks. It is four squares in the published
colours, written by hand for this repository on 2026-10-11.

The one-colour marks (`okta.svg`, `keycloak.svg`, `authentik.svg`) are copied unchanged from
simple-icons 16.32.0 (CC0 1.0), the package the code-host marks already use.

## Trademarks

Each mark is a trademark of its owner (the "G" logo of Google LLC, the four-square logo of Microsoft Corporation). A mark is used only to
identify that sign-in option, and does not imply endorsement of, or affiliation with, Bemmoly.
These files are not covered by the repository's MIT licence.
