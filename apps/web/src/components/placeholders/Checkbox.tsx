/** PLACEHOLDER for @bemmoly/ui Checkbox: the 18px tick box of the roles matrix (16px in lists). */
export interface CheckboxProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  label: string;
  size?: 'md' | 'sm';
  disabled?: boolean;
  /** Read-only boxes keep their look at reduced opacity, like the Org admin column. */
  readOnly?: boolean;
}

export function Checkbox({
  checked,
  onChange,
  label,
  size = 'md',
  disabled,
  readOnly,
}: CheckboxProps) {
  const box = size === 'md' ? 'size-4.5 text-meta' : 'size-4 text-micro';
  const inert = disabled || readOnly;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      aria-readonly={readOnly || undefined}
      disabled={disabled}
      onClick={() => {
        if (!inert) onChange?.(!checked);
      }}
      className={`grid shrink-0 place-items-center rounded-tag border-[1.5px] p-0 leading-none text-on-ac ${box} ${
        checked ? 'border-ac bg-ac' : 'border-box-off bg-sf'
      } ${inert ? 'cursor-default opacity-55' : 'cursor-pointer'} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ac`}
    >
      {checked ? '✓' : ''}
    </button>
  );
}
