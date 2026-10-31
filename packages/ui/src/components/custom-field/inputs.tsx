import { useState, type ReactNode } from 'react';
import { Input } from '../input/input.tsx';

/*
 * Number and money keep what is being typed ("1." on the way to "1.5") as text, and report a
 * number, or null while the box is empty or not a number yet.
 */

interface DraftProps {
  value: number | null;
  onChange: (value: number | null) => void;
  /** Digits after the point the box accepts. */
  decimals: number | undefined;
  suffix?: ReactNode;
  disabled?: boolean | undefined;
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

const show = (value: number | null) => (value === null ? '' : String(value));

export function NumberInput({ value, onChange, decimals, suffix, ...rest }: DraftProps) {
  const [draft, setDraft] = useState(show(value));
  const [seen, setSeen] = useState(value);
  // A value set from outside (a reset, a default) replaces the draft; our own echo does not.
  if (seen !== value) {
    setSeen(value);
    if (!(draft !== '' && Number(draft.replace(',', '.')) === value)) setDraft(show(value));
  }
  return (
    <Input
      {...rest}
      inputMode={decimals === 0 ? 'numeric' : 'decimal'}
      value={draft}
      suffix={suffix}
      onChange={(event) => {
        const text = event.target.value.replace(',', '.');
        setDraft(text);
        const parsed = Number(text);
        onChange(text.trim() === '' || Number.isNaN(parsed) ? null : parsed);
      }}
    />
  );
}

export interface Money {
  amountMinor: number;
  currency: string;
}

/** Minor units per major for a currency: 100 for EUR, 1 for JPY. */
export function minorUnitsOf(currency: string): number {
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
    .maximumFractionDigits;
  return 10 ** (digits ?? 2);
}

export function MoneyInput({
  value,
  currency,
  onChange,
  ...rest
}: Omit<DraftProps, 'value' | 'onChange' | 'decimals' | 'suffix'> & {
  value: Money | null;
  currency: string;
  onChange: (value: Money | null) => void;
}) {
  const unit = minorUnitsOf(currency);
  return (
    <NumberInput
      {...rest}
      value={value === null ? null : value.amountMinor / unit}
      decimals={Math.log10(unit)}
      suffix={<span className="pl-2 text-12 text-tx-3">{currency}</span>}
      onChange={(amount) =>
        onChange(amount === null ? null : { amountMinor: Math.round(amount * unit), currency })
      }
    />
  );
}
