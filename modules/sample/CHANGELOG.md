# @bemmoly/module-sample

## 0.1.4

### Patch Changes

- Updated dependencies [b98d0c0]
  - @bemmoly/core@0.1.4
  - @bemmoly/shared@0.1.4

## 0.1.3

### Patch Changes

- @bemmoly/core@0.1.3
  - @bemmoly/shared@0.1.3

## 0.1.2

### Patch Changes

- 8337385: Fresh installs start with no module enabled. A module runs only once an admin enables it in
  Settings › Modules (or lists it in `BEMMOLY_MODULES`, which still pins the set). Enabling a
  module now asks "Who can use it?": Nobody yet (recommended; only org admins can open it),
  Everyone, or Specific teams. Nothing is granted that the admin did not choose; the access a
  module suggests is shown as a hint only. Access can be changed later under Users › Module
  access, and the audit log records the access chosen on enable. `bemmoly-db modules enable`
  takes `--access none|everyone|teams` and `--team <id>`, and defaults to none. The Sample
  module is a developer example: it stays in the image but is off until enabled and suggests no
  access. Existing installs keep the modules and grants they have; to turn Sample off, use
  Disable in Settings › Modules. No configuration or schema change.
- Updated dependencies [8337385]
- Updated dependencies [8337385]
  - @bemmoly/core@0.1.2
  - @bemmoly/shared@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies [a2b7f81]
  - @bemmoly/core@0.1.1
  - @bemmoly/shared@0.1.1

## 0.1.0

### Patch Changes

- Updated dependencies [293b01b]
- Updated dependencies [b403d58]
- Updated dependencies [c7e5a48]
  - @bemmoly/core@0.1.0
  - @bemmoly/shared@0.1.0
