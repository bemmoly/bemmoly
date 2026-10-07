export type ChangelogErrorKind =
  | 'invalid_changelog'
  | 'checksum_mismatch'
  | 'precondition_failed'
  | 'started_unfinished'
  | 'irreversible'
  | 'unknown_target'
  | 'changeset_failed';

/**
 * A changelog that cannot be applied or rolled back. Boot fails on it with the
 * message, which names the module, the changeset and what to do next.
 */
export class ChangelogError extends Error {
  override readonly name = 'ChangelogError';
  readonly kind: ChangelogErrorKind;
  readonly details: unknown;

  constructor(
    kind: ChangelogErrorKind,
    message: string,
    options: { details?: unknown; cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.kind = kind;
    this.details = options.details;
  }
}
