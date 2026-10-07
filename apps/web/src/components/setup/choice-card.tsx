import { Badge, SelectableCard } from '@bemmoly/ui';
import type { ReactNode } from 'react';

/** The 32px initials tile from the Setup mock's import and provider cards. */
export function InitialsTile({ text }: { text: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-panel bg-chip text-12 font-semibold text-tx2"
    >
      {text}
    </span>
  );
}

interface ChoiceCardProps {
  initials: string;
  name: string;
  description?: ReactNode;
  /** A mono line such as a catalog id, for cards without a description. */
  detail?: string;
  badge?: string | null;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

/** A Setup option card: tile, 14px name, optional badge, then the description. */
export function ChoiceCard({
  initials,
  name,
  description,
  detail,
  badge,
  selected,
  onSelect,
  disabled,
}: ChoiceCardProps) {
  return (
    <SelectableCard
      selected={selected}
      onClick={onSelect}
      disabled={disabled}
      className="disabled:cursor-not-allowed"
    >
      <span className="flex w-full items-center gap-2.5">
        <InitialsTile text={initials} />
        <span className="min-w-0 truncate text-14 font-semibold">{name}</span>
        {badge ? (
          <Badge tone="accent" className="ml-auto">
            {badge}
          </Badge>
        ) : null}
      </span>
      {description ? <span className="text-12h leading-body text-tx4">{description}</span> : null}
      {detail ? <span className="font-mono text-12 text-tx4">{detail}</span> : null}
    </SelectableCard>
  );
}
