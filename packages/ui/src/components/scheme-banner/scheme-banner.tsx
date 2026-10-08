import type { ReactNode } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';

export interface SchemeOverrideBannerProps {
  /** "Org default: Software (Scrum)". */
  scheme: ReactNode;
  /** Opens the scheme picker; without it the scheme is shown as text. */
  onPickScheme?: () => void;
  overrideCount: number;
  onViewDiff: () => void;
  /** Puts every overridden setting back; the mock keeps this with the page actions. */
  onReset?: () => void;
  className?: string;
}

/**
 * The "Inherits from" bar of Board Settings: 10px 14px in a 7px card, the scheme in a bg2
 * control with its 8px tx4 square, the override count in tx4 and "View diff" in the accent.
 */
export function SchemeOverrideBanner({
  scheme,
  onPickScheme,
  overrideCount,
  onViewDiff,
  onReset,
  className,
}: SchemeOverrideBannerProps) {
  const control = (
    <>
      <span aria-hidden className="size-2 rounded-tick bg-tx4" />
      {scheme}
      {onPickScheme && <Icon name="caret" size={14} className="text-tx5" />}
    </>
  );
  const controlClass =
    'flex items-center gap-2 rounded-control border border-br3 bg-bg2 px-2.5 py-1.25 font-sans text-13 text-tx';
  return (
    <div
      className={cx(
        'flex flex-wrap items-center gap-3 rounded-panel border border-br bg-sf px-3.5 py-2.5 text-13 text-tx',
        className,
      )}
    >
      <span className="font-semibold">Inherits from</span>
      {onPickScheme ? (
        <button
          type="button"
          aria-haspopup="listbox"
          onClick={onPickScheme}
          className={cx(controlClass, 'cursor-pointer hover:bg-bg', focusRing)}
        >
          {control}
        </button>
      ) : (
        <span className={controlClass}>{control}</span>
      )}
      <span className="text-tx4">
        {overrideCount} {overrideCount === 1 ? 'setting' : 'settings'} overridden on this project
      </span>
      <span className="ml-auto flex items-center gap-3.5">
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className={cx(
              'cursor-pointer rounded-xs border-0 bg-transparent p-0 font-sans text-13 font-medium text-tx4 hover:text-tx2',
              focusRing,
            )}
          >
            Reset to org default
          </button>
        )}
        <button
          type="button"
          onClick={onViewDiff}
          className={cx(
            'cursor-pointer rounded-xs border-0 bg-transparent p-0 font-sans text-13 font-medium text-ac hover:text-ac-d',
            focusRing,
          )}
        >
          View diff
        </button>
      </span>
    </div>
  );
}
