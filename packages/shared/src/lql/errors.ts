/**
 * A user-facing problem in a query, positioned so the filter bar can underline
 * it inline. Parsing and validation never throw for user mistakes; they return
 * these. Only programming errors (a broken catalog) throw.
 */
export interface LqlError {
  message: string;
  position: number;
  length: number;
  /** What would have been accepted at `position`, for the inline hint. */
  expected?: string[];
}

export type LqlResult<T> = { ok: true; value: T } | { ok: false; error: LqlError };
