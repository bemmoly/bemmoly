import type { ReactNode } from 'react';

/** PLACEHOLDER for @bemmoly/ui Tag: team chips in the users table, email chips in invites. */
export interface TagProps {
  children: ReactNode;
  tone?: 'neutral' | 'accent';
  size?: 'sm' | 'md';
  onRemove?: () => void;
  removeLabel?: string;
}

export function Tag({ children, tone = 'neutral', size = 'sm', onRemove, removeLabel }: TagProps) {
  const colours = tone === 'accent' ? 'bg-ac-bg font-medium text-ac' : 'bg-chip text-tx2';
  const shape =
    size === 'sm' ? 'rounded-chip px-1.75 py-0.5 text-meta' : 'rounded-tag px-2 py-0.75 text-small';
  return (
    <span className={`inline-flex items-center gap-1.5 ${shape} ${colours}`}>
      {children}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel ?? 'Remove'}
          className="cursor-pointer border-0 bg-transparent p-0 leading-none text-tx5 hover:text-tx"
        >
          ×
        </button>
      ) : null}
    </span>
  );
}
