import { SelectableCard } from '@bemmoly/ui';
import type { ReactNode } from 'react';

/** One option of a setup choice: a radio card with a title, a line, and anything under it. */
export function Choice({
  selected,
  onSelect,
  title,
  description,
  children,
  disabled,
}: {
  selected: boolean;
  onSelect: () => void;
  title: ReactNode;
  description: ReactNode;
  children?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <SelectableCard selected={selected} onClick={onSelect} disabled={disabled} className="gap-1">
      <span className="flex items-center gap-2 text-13 font-semibold text-tx">{title}</span>
      <span className="text-12 text-tx-3">{description}</span>
      {children}
    </SelectableCard>
  );
}
