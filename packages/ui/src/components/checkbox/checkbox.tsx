import { useCallback, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';

export type CheckSize = 'sm' | 'md';

/** 16px with a 10px tick (Board Settings card fields, Setup) or 18px with 11px (permission matrix). */
const BOX: Record<CheckSize, string> = { sm: 'size-4 text-11', md: 'size-4.5 text-11' };

interface ToggleInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  size?: CheckSize;
  /** Visible label beside the box; without it pass aria-label. */
  label?: ReactNode;
  /** Secondary line under the label. */
  description?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

function Labelled({
  control,
  label,
  description,
  disabled,
}: {
  control: ReactNode;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean | undefined;
}) {
  if (!label) return <>{control}</>;
  return (
    <label
      className={cx(
        'inline-flex items-start gap-2.5',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
      )}
    >
      {control}
      <span className="flex flex-col gap-0.5">
        <span className="font-medium text-tx">{label}</span>
        {description && <span className="text-12 text-tx-3">{description}</span>}
      </span>
    </label>
  );
}

export interface CheckboxProps extends ToggleInputProps {
  /**
   * Some but not all of what it stands for is ticked (a select-all over a list): sets the
   * input's indeterminate property, reads as "mixed" and draws a minus on the accent fill.
   */
  indeterminate?: boolean;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T) {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

/**
 * Unchecked: 1.5px br-ctl border on the surface. Checked: accent fill with a white tick.
 * Indeterminate: the same fill with a white minus.
 */
export function Checkbox({
  size = 'sm',
  label,
  description,
  className,
  disabled,
  indeterminate = false,
  ref,
  ...rest
}: CheckboxProps) {
  const setRef = useCallback(
    (element: HTMLInputElement | null) => {
      if (element) element.indeterminate = indeterminate;
      assignRef(ref, element);
    },
    [indeterminate, ref],
  );
  const mark = size === 'sm' ? 10 : 12;
  const control = (
    <span className={cx('relative inline-flex shrink-0', BOX[size])}>
      <input
        ref={setRef}
        type="checkbox"
        disabled={disabled}
        aria-checked={indeterminate ? 'mixed' : undefined}
        className={cx(
          'peer m-0 size-full cursor-pointer appearance-none rounded-chip border-[1.5px]',
          indeterminate ? 'border-acc-fill bg-acc-fill' : 'border-tx-3 bg-card',
          'checked:border-acc-fill checked:bg-acc-fill disabled:cursor-not-allowed disabled:opacity-55',
          focusRing,
          className,
        )}
        {...rest}
      />
      <span
        aria-hidden
        className={cx(
          'pointer-events-none absolute inset-0 items-center justify-center text-on-acc',
          indeterminate ? 'flex' : 'hidden peer-checked:flex',
        )}
      >
        <Icon name={indeterminate ? 'minus' : 'check'} size={mark} />
      </span>
    </span>
  );
  return <Labelled control={control} label={label} description={description} disabled={disabled} />;
}

export type RadioProps = Omit<ToggleInputProps, 'size'>;

/** The Board Settings radio: 16px ring, selected shows a white gap and an accent dot. */
export function Radio({ label, description, className, disabled, ref, ...rest }: RadioProps) {
  const control = (
    <input
      ref={ref}
      type="radio"
      disabled={disabled}
      className={cx(
        'm-0 size-4 shrink-0 cursor-pointer appearance-none rounded-full border-[1.5px] border-tx-3 bg-card',
        'checked:border-acc-fill checked:shadow-radio disabled:cursor-not-allowed disabled:opacity-55',
        focusRing,
        className,
      )}
      {...rest}
    />
  );
  return <Labelled control={control} label={label} description={description} disabled={disabled} />;
}
