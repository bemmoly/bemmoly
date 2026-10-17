import type { RunGlyphState } from './run-glyph.tsx';

/** English words for stories and tests; apps pass their own catalog's words. */
export const RUN_STATE_WORDS: Readonly<Record<RunGlyphState, string>> = {
  queued: 'Queued',
  running: 'Running',
  passed: 'Passed',
  failed: 'Failed',
  waiting: 'Waiting',
  skipped: 'Skipped',
  rolled_back: 'Rolled back',
};
