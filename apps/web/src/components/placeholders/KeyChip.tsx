import type { ReactNode } from 'react';

/** PLACEHOLDER for @bemmoly/ui KeyChip: "esc" in the palette input, "↑↓ ⏎ ⌘⏎" in its footer. */
export function KeyChip({
  children,
  variant = 'field',
}: {
  children: ReactNode;
  variant?: 'field' | 'hint';
}) {
  const shape =
    variant === 'field'
      ? 'rounded-tag px-1.5 py-0.5 text-tx5'
      : 'rounded-chip bg-sf px-1.25 py-px text-tx4';
  return (
    <kbd className={`border border-br font-mono text-mono font-medium ${shape}`}>{children}</kbd>
  );
}
