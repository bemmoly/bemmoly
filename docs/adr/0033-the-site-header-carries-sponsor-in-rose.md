# ADR 0033: The site header carries Sponsor, in rose

- Status: accepted
- Date: 2026-10-11
- Changes: [marketing-site.md](../design/system/marketing-site.md) ("the site's one sponsor
  link, the footer's Buy me a coffee")
- Evidence: owner feedback on bemmoly.com after launch: the footer link went unseen, and the
  header's Live demo read as plain text beside Install

## Context

The only way to support the project was a quiet link at the bottom of every page. The owner
wants it visible without turning the site into a sales page, and without competing with
Install, the one primary action.

## Decision

- The header gets a **Sponsor** link with a heart, to the same Buy Me a Coffee page as the
  footer, set slightly apart from Live demo and Install. It is a soft rose tint with a rose
  hairline and rose text, never a filled red. On a phone it lives in the menu sheet; the bar
  keeps Install and the menu button.
- The colour is three **site-only aliases** in `apps/site/src/styles/site.css`
  (`--color-sponsor`, `--color-sponsor-soft`, `--color-sponsor-line`) of the product's existing
  `red-tx` and `red-50`, so no new literal colour exists and both themes hold AA text contrast
  (`tests/sponsor.test.ts`). The product never uses them; red stays the product's danger colour.
- Live demo in the header becomes an outlined secondary button, before Install.
- The footer link stays, with its "optional support that unlocks nothing" line.

## Consequences

`tests/promises.test.ts` allows exactly two sponsor links in the header (bar and menu) plus the
footer's one, each to the funding page, with no logo and no sales words.

## Alternatives

- A filled red button: louder than Install, and reads as an error or a sale.
- The accent colour: indistinguishable from Install and the links.
- A new product red token: the product has no use for it; the alias keeps it to the site.
