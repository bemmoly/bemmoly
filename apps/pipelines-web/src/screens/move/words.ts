import { getLocale } from '@bemmoly/core-web';
import type { MoveStep, RuntimeMove } from '@bemmoly/module-pipelines/shared';
import type { RunGlyphState } from '@bemmoly/ui';

/* How a move's states read as glyphs, and its money as dollars. */

export const MOVE_GLYPH: Record<RuntimeMove['state'], RunGlyphState> = {
  planned: 'queued',
  deploying: 'running',
  warming: 'running',
  shifting: 'running',
  holding: 'running',
  paused: 'waiting',
  succeeded: 'passed',
  rolled_back: 'rolled_back',
  failed: 'failed',
  cancelled: 'skipped',
};

export function stepGlyph(step: MoveStep, move: RuntimeMove): RunGlyphState {
  if (step.state === 'done') return 'passed';
  if (step.state === 'next') return 'queued';
  return move.state === 'paused' ? 'waiting' : 'running';
}

/** 18.25 as "$18.25". */
export function formatDollars(value: number, locale = getLocale()): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(value);
}
