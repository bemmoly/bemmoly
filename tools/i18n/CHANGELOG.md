# @bemmoly/i18n-tools

## 0.12.0

### Minor Changes

- 403ef1d: Bemmoly is ready to speak other languages. Settings › Profile has a Language setting, saved on
  your account so every device follows it: Automatic follows your browser, or pick a language.
  English is the only language shipped so far, so nothing reads differently today; dates, times and
  numbers now follow your language through the browser's own formatting. Settings › Workspace
  offers only the languages Bemmoly ships.

  For people building Bemmoly: the sidebar, menus, page header, phone bar, sign-in and Profile read
  their words from message catalogs (ICU, one per namespace, compiled at build time), modules can
  bring their own through `@bemmoly/core-web`, and `?locale=en-XA` shows a screen in an accented,
  padded pseudo-language for checking layout. API error bodies may now carry `messageId` and
  `values` beside `message`; existing clients are unaffected. The password reset email is written
  through the server's catalog in the workspace's language. See `docs/i18n.md` and ADR 0025.

### Patch Changes

- Updated dependencies [b769aed]
- Updated dependencies [403ef1d]
- Updated dependencies [ea2125f]
  - @bemmoly/shared@0.12.0
