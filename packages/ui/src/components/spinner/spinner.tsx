import { cx } from '../../lib/cx.ts';

export interface SpinnerProps {
  /** Diameter in px; 12 matches the mock's open-ring glyph. */
  size?: number;
  /** Announced to assistive tech; omit when a parent already says it is busy. */
  label?: string;
  className?: string;
}

/** The mock's open ring (a circle with its right border transparent), turning. */
export function Spinner({ size = 12, label, className }: SpinnerProps) {
  return (
    <span
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cx(
        'inline-block shrink-0 rounded-full border-[1.5px] border-current border-r-transparent',
        'motion-safe:animate-spin',
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}
