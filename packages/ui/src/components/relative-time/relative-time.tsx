import { cx } from '../../lib/cx.ts';
import { formatAbsolute, formatRelative } from '../../lib/time.ts';

export interface RelativeTimeProps {
  /** An ISO timestamp. */
  iso: string;
  /** "now" for tests and screenshots; the current time by default. */
  now?: Date;
  className?: string;
}

/**
 * "3h ago" that shows the absolute date and time on hover and gives it to assistive tech, as
 * a <time> with a machine-readable dateTime (docs/design/premium/interaction.md).
 */
export function RelativeTime({ iso, now, className }: RelativeTimeProps) {
  const absolute = formatAbsolute(iso);
  return (
    <time
      dateTime={iso}
      title={absolute}
      className={cx('whitespace-nowrap tabular-nums', className)}
    >
      <span aria-hidden>{formatRelative(iso, now)}</span>
      <span className="sr-only">{absolute}</span>
    </time>
  );
}
