import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';

export type CheckSize = 'sm' | 'md';

/** 16px with a 10px tick (Board Settings card fields, Setup) or 18px with 11px (permission matrix). */
const BOX: Record<CheckSize, string> = { sm: 'size-4 text-10', md: 'size-4.5 text-11' };

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
        {description && <span className="text-12 text-tx5">{description}</span>}
      </span>
    </label>
  );
}

export type CheckboxProps = ToggleInputProps;

/** Unchecked: 1.5px br-ctl border on the surface. Checked: accent fill with a white tick. */
export function Checkbox({
  size = 'sm',
  label,
  description,
  className,
  disabled,
  ref,
  ...rest
}: CheckboxProps) {
  const control = (
    <span className={cx('relative inline-flex shrink-0', BOX[size])}>
      <input
        ref={ref}
        type="checkbox"
        disabled={disabled}
        className={cx(
          'peer m-0 size-full cursor-pointer appearance-none rounded-xs border-[1.5px] border-br-ctl bg-sf',
          'checked:border-ac-fill checked:bg-ac-fill disabled:cursor-not-allowed disabled:opacity-55',
          focusRing,
          className,
        )}
        {...rest}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden items-center justify-center text-on-acc peer-checked:flex"
      >
        <Icon name="check" size={size === 'sm' ? 10 : 12} />
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
        'm-0 size-4 shrink-0 cursor-pointer appearance-none rounded-full border-[1.5px] border-br-ctl bg-sf',
        'checked:border-ac-fill checked:shadow-radio disabled:cursor-not-allowed disabled:opacity-55',
        focusRing,
        className,
      )}
      {...rest}
    />
  );
  return <Labelled control={control} label={label} description={description} disabled={disabled} />;
}
