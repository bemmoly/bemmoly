import { cx } from '../../lib/cx.ts';
import { RunGlyph, type RunGlyphState } from '../run-glyph/run-glyph.tsx';

export interface JourneyStation {
  key: string;
  /** "Build", "Staging", "Prod asia": short, it sits under the glyph. */
  label: string;
  state: RunGlyphState;
  /** Meta under the label: "2m", "25% canary", "approval". */
  detail?: string;
  /** The station the change is at now; drawn heavier so the eye lands on it. */
  live?: boolean;
}

export interface JourneyProps {
  stations: readonly JourneyStation[];
  /** How far along the track the change is, 0 to 1; the accent fill stops there. */
  progress?: number;
  /** Glyph and label only: for narrow cards and lists of many journeys. */
  compact?: boolean;
  /** Names the whole journey: "Retry UPI collect on gateway timeout, from commit to Prod". */
  ariaLabel: string;
  /** The state in words for assistive tech, in the person's language ("Passed"). */
  stateLabel: (state: RunGlyphState) => string;
  className?: string;
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));

/**
 * A change as a line of stations from commit to the last Prod region, with the live station
 * marked: "where is my change?" in one glance. The strip scrolls inside itself when the
 * stations do not fit, so a phone never scrolls the page sideways.
 */
export function Journey({
  stations,
  progress = 0,
  compact = false,
  ariaLabel,
  stateLabel,
  className,
}: JourneyProps) {
  const count = Math.max(stations.length, 1);
  // The track runs between the first and the last glyph's centres.
  const inset = `calc(100% / ${count * 2})`;
  const span = `calc(100% - 100% / ${count})`;
  return (
    <div className={cx('overflow-x-auto', className)}>
      <ol
        aria-label={ariaLabel}
        className="relative grid"
        style={{
          gridTemplateColumns: `repeat(${count}, minmax(${compact ? 44 : 56}px, 1fr))`,
        }}
      >
        <span
          aria-hidden
          className="absolute top-1.75 h-0.5 rounded-tick bg-line"
          style={{ left: inset, width: span }}
        />
        <span
          aria-hidden
          data-part="fill"
          className="absolute top-1.75 h-0.5 rounded-tick bg-done"
          style={{ left: inset, width: `calc(${span} * ${clamp(progress)})` }}
        />
        {stations.map((station) => (
          <li
            key={station.key}
            aria-current={station.live ? 'step' : undefined}
            className="relative flex min-w-0 flex-col items-center gap-1 px-0.5 text-center text-11"
          >
            <span className={cx('flex rounded-full bg-card', station.live && 'shadow-ring')}>
              <RunGlyph state={station.state} size={16} />
            </span>
            <span
              className={cx(
                'max-w-full truncate',
                station.live ? 'font-semibold text-tx' : 'font-medium text-tx-2',
              )}
            >
              {station.label}
            </span>
            <span className="sr-only">{stateLabel(station.state)}</span>
            {!compact && (
              <span className="max-w-full truncate text-tx-3" aria-hidden={!station.detail}>
                {station.detail || ' '}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
