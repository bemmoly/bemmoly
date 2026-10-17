import { Icon } from '@bemmoly/ui/icons';
import type { ReactNode } from 'react';

interface DisclosureButtonProps {
  expanded: boolean;
  /** The id of what it shows and hides. */
  controls: string;
  onToggle: () => void;
  children: ReactNode;
}

/** "Show 8 more projects", "Review all 86 people": a quiet button that opens a list below. */
export function DisclosureButton({
  expanded,
  controls,
  onToggle,
  children,
}: DisclosureButtonProps) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onToggle}
      className="-mx-1 inline-flex cursor-pointer items-center gap-1.5 self-start rounded-control border-0 bg-transparent px-1 py-0.5 font-sans text-12 font-medium text-tx-2 hover:bg-hover hover:text-tx focus-ring"
    >
      <Icon name={expanded ? 'caret' : 'chevron'} size={14} className="text-tx-3" />
      {children}
    </button>
  );
}
