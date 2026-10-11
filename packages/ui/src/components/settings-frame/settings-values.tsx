import type { ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';

export interface SettingsValuesProps {
  children: ReactNode;
  className?: string;
}

/** The read view of a section: label and value rows, divided like SettingsRow. */
export function SettingsValues({ children, className }: SettingsValuesProps) {
  return <dl className={cx('m-0 flex flex-col', className)}>{children}</dl>;
}

export interface SettingsValueProps {
  label: ReactNode;
  children: ReactNode;
  /** A line under the value, such as where it comes from or what it affects. */
  hint?: ReactNode;
  /** Values that are codes, paths or numbers set in the mono face. */
  mono?: boolean;
  /** An unset value reads lighter ("Not set", "Off"). */
  muted?: boolean;
}

/** 10px rows: label in tx-2 on two fifths of the width, the value beside it; stacked on phones. */
export function SettingsValue({ label, children, hint, mono, muted }: SettingsValueProps) {
  return (
    <div className="grid grid-cols-1 items-baseline gap-x-4 gap-y-0.5 border-b border-line-2 py-2.5 last:border-b-0 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <dt className="text-tx-2">{label}</dt>
      <dd className="m-0 flex min-w-0 flex-col gap-0.5">
        <span
          className={cx(
            'break-words',
            mono ? 'font-mono text-12' : 'font-medium',
            muted ? 'font-normal text-tx-3' : 'text-tx',
          )}
        >
          {children}
        </span>
        {hint && <span className="text-12 text-tx-3">{hint}</span>}
      </dd>
    </div>
  );
}
