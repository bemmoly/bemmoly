/** How `pnpm eval` runs, parsed once in vitest.eval.config.ts and handed to every eval. */
export interface EvalMode {
  /** A live provider (nightly, or re-recording); null replays the checked-in recordings. */
  live: {
    provider: string;
    model: string;
    credentials: Record<string, string>;
    baseUrl: string | null;
  } | null;
  /** Write what the live provider answered over the recordings. */
  record: boolean;
}

declare module 'vitest' {
  export interface ProvidedContext {
    evalMode: EvalMode;
  }
}
