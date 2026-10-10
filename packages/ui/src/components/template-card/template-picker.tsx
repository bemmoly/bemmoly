import type { ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { Skeleton } from '../skeleton/skeleton.tsx';
import { TemplateCard } from './template-card.tsx';

export interface PickerTemplate {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  /** Groups the grid: "Engineering", "Product". Templates without one go under "General". */
  category?: string | null;
}

export interface TemplatePickerProps {
  templates: readonly PickerTemplate[];
  /** null is the blank page. */
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** A double click or Enter on the chosen card: create straight away. */
  onChoose?: (id: string | null) => void;
  loading?: boolean;
  /** Shown instead of the cards when the list failed. */
  error?: ReactNode;
  className?: string;
}

const GENERAL = 'General';

function groups(templates: readonly PickerTemplate[]) {
  const byCategory = new Map<string, PickerTemplate[]>();
  for (const template of templates) {
    const name = template.category?.trim() || GENERAL;
    byCategory.set(name, [...(byCategory.get(name) ?? []), template]);
  }
  return [...byCategory.entries()];
}

const GRID = 'grid grid-cols-1 gap-2 sm:grid-cols-2';

/**
 * The template picker's body: a blank page first, then the templates by category, two to a
 * row on the chip grid of the Docs home's Templates panel. Choosing a card selects it; a
 * double click (or Enter on the selected card) creates the page at once.
 */
export function TemplatePicker({
  templates,
  selectedId,
  onSelect,
  onChoose,
  loading = false,
  error,
  className,
}: TemplatePickerProps) {
  const card = (template: PickerTemplate | null) => {
    const id = template?.id ?? null;
    const selected = selectedId === id;
    return (
      <TemplateCard
        key={id ?? 'blank'}
        name={template?.name ?? 'Blank page'}
        description={template ? template.description : 'Start from an empty page.'}
        icon={template?.icon ?? null}
        blank={!template}
        selected={selected}
        onClick={() => onSelect(id)}
        onDoubleClick={() => onChoose?.(id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && selected && onChoose) {
            event.preventDefault();
            onChoose(id);
          }
        }}
      />
    );
  };

  return (
    <div className={cx('flex flex-col gap-4', className)}>
      <div className={GRID}>{card(null)}</div>
      {error ? (
        <p role="alert" className="m-0 text-12h text-danger">
          {error}
        </p>
      ) : loading ? (
        <div aria-hidden className={GRID}>
          {Array.from({ length: 4 }, (_, index) => (
            <span key={index} className="flex gap-2.5 rounded-card border border-br p-3">
              <Skeleton width={28} height={28} shape="block" />
              <span className="flex flex-1 flex-col gap-1.5 pt-0.5">
                <Skeleton width="55%" height={11} />
                <Skeleton width="85%" height={9} />
              </span>
            </span>
          ))}
        </div>
      ) : (
        groups(templates).map(([category, list]) => (
          <section key={category} aria-label={category} className="flex flex-col gap-2">
            <h3 className="m-0 text-11 font-semibold tracking-caps text-tx5 uppercase">
              {category}
            </h3>
            <div className={GRID}>{list.map((template) => card(template))}</div>
          </section>
        ))
      )}
    </div>
  );
}
