import type { ImportSource } from '@bemmoly/shared';
import { Icon } from '@bemmoly/ui/icons';
import type { ReactNode } from 'react';
import type { ImportSourceId } from '../../store/setup.ts';
import { ChoiceCard } from '../setup/choice-card.tsx';
import { IMPORT_MARKS } from '../setup/option-marks.tsx';

/** A source's tile: its mark when one is drawn, else a neutral table glyph. */
export function sourceMark(id: string): ReactNode {
  return IMPORT_MARKS[id as ImportSourceId] ?? <Icon name="table" size={16} />;
}

export interface PickerCard {
  id: string;
  name: string;
  description: string;
  initials: string;
  /** Shown but not selectable; the badge says what it waits on ("Needs Work"). */
  unavailable?: string;
}

export const cardOf = (source: ImportSource): PickerCard => ({
  id: source.id,
  name: source.label,
  description: source.description,
  initials: source.label.slice(0, 2).toUpperCase(),
});

interface SourcePickerProps {
  cards: readonly PickerCard[];
  selected: string | null;
  onSelect: (id: string) => void;
}

/** The import sources as option cards, one picked at a time. */
export function SourcePicker({ cards, selected, onSelect }: SourcePickerProps) {
  return (
    <div role="radiogroup" aria-label="Import source" className="grid gap-3 sm:grid-cols-2">
      {cards.map((card) => (
        <ChoiceCard
          key={card.id}
          initials={card.initials}
          icon={sourceMark(card.id)}
          name={card.name}
          description={card.description}
          badge={card.unavailable ?? null}
          disabled={Boolean(card.unavailable)}
          selected={selected === card.id}
          onSelect={() => onSelect(card.id)}
        />
      ))}
    </div>
  );
}
