# @bemmoly/updater

## 0.2.1

### Patch Changes

- @bemmoly/shared@0.2.1

## 0.2.0

### Patch Changes

- Updated dependencies [51cd3ae]
- Updated dependencies [e2aa5d2]
  - @bemmoly/shared@0.2.0

## 0.1.7

### Patch Changes

- 1830ed0: Fix in-app updates failing at the verify step with "mkdir /root/.sigstore: read-only file system". The updater runs on a read-only filesystem, and the signature check could not cache Sigstore's trust root. It now caches it in /tmp. Installs on 0.1.6 or older update once with `sudo bemmoly upgrade` to get the fixed updater; from then on, Update in Settings › Updates works.
- @bemmoly/shared@0.1.7

## 0.1.6

### Patch Changes

- @bemmoly/shared@0.1.6

## 0.1.5

### Patch Changes

- @bemmoly/shared@0.1.5

## 0.1.4

### Patch Changes

- @bemmoly/shared@0.1.4

## 0.1.3

### Patch Changes

- @bemmoly/shared@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies [8337385]
- Updated dependencies [8337385]
  - @bemmoly/shared@0.1.2

## 0.1.1

### Patch Changes

- @bemmoly/shared@0.1.1

## 0.1.0

### Patch Changes

- Updated dependencies [b403d58]
  - @bemmoly/shared@0.1.0
