import type { ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';

/**
 * The one vocabulary for a run, a job, a step and a journey's station. Rolled back is amber,
 * not red: the roll back worked and the service is safe again; red stays for what is broken
 * now, so a page of red always means "act".
 */
export type RunGlyphState =
  'queued' | 'running' | 'passed' | 'failed' | 'waiting' | 'skipped' | 'rolled_back';

export const RUN_GLYPH_STATES: readonly RunGlyphState[] = [
  'queued',
  'running',
  'passed',
  'failed',
  'waiting',
  'skipped',
  'rolled_back',
];

export type RunGlyphSize = 12 | 14 | 16 | 18;

export interface RunGlyphProps {
  state: RunGlyphState;
  /** 14 in rows, 16 on journeys and graph nodes, 18 beside a page title. */
  size?: RunGlyphSize;
  /**
   * Names the state for assistive tech ("Failed"). Without it the glyph is decorative, for
   * when the state's word is already beside it.
   */
  label?: string;
  className?: string;
}

const MARK = 'var(--on-solid)';

/** Drawn on a 16-unit grid, as the product design's sprite draws them. */
const DRAWINGS: Record<RunGlyphState, () => ReactNode> = {
  passed: () => (
    <>
      <circle cx="8" cy="8" r="7" fill="var(--done)" />
      <path
        d="m4.8 8.2 2.1 2.1 4.3-4.4"
        fill="none"
        stroke={MARK}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  failed: () => (
    <>
      <circle cx="8" cy="8" r="7" fill="var(--red)" />
      <path
        d="m5.6 5.6 4.8 4.8M10.4 5.6l-4.8 4.8"
        stroke={MARK}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </>
  ),
  running: () => (
    <>
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="var(--line)" strokeWidth="1.8" />
      {/* The arc turns about the centre; under reduced motion it rests at the top right. */}
      <g data-part="arc" className="origin-center motion-safe:animate-spin">
        <path
          d="M8 1.8A6.2 6.2 0 0 1 14.2 8"
          fill="none"
          stroke="var(--prog)"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </g>
      <circle cx="8" cy="8" r="2.4" fill="var(--prog)" />
    </>
  ),
  waiting: () => (
    <>
      <circle cx="8" cy="8" r="7" fill="var(--amber)" />
      <path d="M6.4 5.4v5.2M9.6 5.4v5.2" stroke={MARK} strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  queued: () => (
    <circle
      cx="8"
      cy="8"
      r="6.2"
      fill="none"
      stroke="var(--todo)"
      strokeWidth="1.6"
      strokeDasharray="2.4 2.2"
    />
  ),
  skipped: () => (
    <>
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="var(--todo)" strokeWidth="1.6" />
      <path d="m4.4 11.6 7.2-7.2" stroke="var(--todo)" strokeWidth="1.6" />
    </>
  ),
  rolled_back: () => (
    <>
      <circle cx="8" cy="8" r="7" fill="var(--amber)" />
      <path
        d="M5 6.5h4.2a2.3 2.3 0 0 1 0 4.6H7M5 6.5l1.8-1.8M5 6.5l1.8 1.8"
        fill="none"
        stroke={MARK}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
};

/** A run's state as a drawn mark: shapes and tokens only, never a character. */
export function RunGlyph({ state, size = 14, label, className }: RunGlyphProps) {
  return (
    <svg
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      data-state={state}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={cx('inline-block shrink-0', className)}
    >
      {label && <title>{label}</title>}
      {DRAWINGS[state]()}
    </svg>
  );
}
