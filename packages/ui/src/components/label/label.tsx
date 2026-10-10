import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';

/** A label as stored: its name and, when it has one, its colour as hex. */
export interface LabelValue {
  name: string;
  color?: string | null;
}

export interface LabelProps extends LabelValue {
  /** Adds a remove button named after the label. */
  onRemove?: () => void;
  className?: string;
}

/**
 * An issue or page label: an outlined pill with a dot in the label's own colour, so labels
 * never compete with type or status colours (docs/design/premium/kit.css, `.lbl`). The colour
 * is the label's data; without one the dot takes the muted ink.
 */
export function Label({ name, color, onRemove, className }: LabelProps) {
  return (
    <span
      className={cx(
        'inline-flex h-5 shrink-0 items-center gap-1.25 rounded-full border border-line pr-1.75 pl-1.5 text-12 whitespace-nowrap text-tx-2',
        className,
      )}
    >
      <i
        aria-hidden
        style={color ? { background: color } : undefined}
        className={cx('size-1.5 shrink-0 rounded-full', !color && 'bg-tx-3')}
      />
      {name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove label ${name}`}
          className={cx(
            '-mr-0.5 inline-flex cursor-pointer rounded-full border-0 bg-transparent p-0 text-tx-3 hover:text-tx',
            focusRing,
          )}
        >
          <Icon name="close" size={10} />
        </button>
      )}
    </span>
  );
}
