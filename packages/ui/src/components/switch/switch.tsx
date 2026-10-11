import type { ButtonHTMLAttributes } from 'react';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';

export type SwitchSize = 'sm' | 'md';

/**
 * md: 34x20 track, 16px knob, 2px inset (settings rows). sm: 30x18 track, 14px knob (the lock
 * column of the roles matrix). On is the accent, off is br-off; the knob slides in .15s.
 */
const SIZES: Record<SwitchSize, { track: string; knob: string; on: string }> = {
  md: { track: 'h-5 w-8.5', knob: 'size-4', on: 'translate-x-3.5' },
  sm: { track: 'h-4.5 w-7.5', knob: 'size-3.5', on: 'translate-x-3' },
};

export interface SwitchProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange' | 'value'
> {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  size?: SwitchSize;
}

export function Switch({
  checked,
  onCheckedChange,
  size = 'md',
  className,
  disabled,
  onClick,
  ...rest
}: SwitchProps) {
  const s = SIZES[size];
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onCheckedChange?.(!checked);
      }}
      className={cx(
        'relative inline-flex shrink-0 cursor-pointer rounded-full border-0 p-0',
        checked ? 'bg-acc-fill' : 'bg-line',
        'disabled:cursor-not-allowed disabled:opacity-55',
        s.track,
        focusRing,
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden
        className={cx(
          'absolute top-0.5 left-0.5 rounded-full bg-on-solid motion-safe:transition-transform',
          s.knob,
          checked && s.on,
        )}
      />
    </button>
  );
}
