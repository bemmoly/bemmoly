import { Card } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { LqlFieldCatalog } from '@bemmoly/shared';
import type { ReactNode } from 'react';
import { cx } from '../cx.ts';
import { useDragList } from '../drag.ts';
import { LqlInput } from '../lql/lql-input.tsx';

export interface NamedQuery {
  name: string;
  query: string;
}

export interface NamedQueriesProps {
  title: string;
  /** "+ Add lane". */
  addLabel: string;
  /** Singular noun for labels: "lane", "quick filter". */
  noun: string;
  items: readonly NamedQuery[];
  editable: boolean;
  catalog: LqlFieldCatalog;
  values: Readonly<Record<string, readonly string[]>>;
  footer: ReactNode;
  onChange: (items: NamedQuery[]) => void;
}

/**
 * The mock's "Custom lanes" card, also used for quick filters: a header with
 * the add action, then rows of grip, name, LQL query and remove.
 */
export function NamedQueries(props: NamedQueriesProps) {
  const { items, editable, onChange } = props;
  const drag = useDragList({
    disabled: !editable,
    onMove: (from, to) => {
      const next = [...items];
      const [moved] = next.splice(from, 1);
      if (moved) next.splice(to, 0, moved);
      onChange(next);
    },
  });
  const set = (index: number, patch: Partial<NamedQuery>) =>
    onChange(items.map((item, at) => (at === index ? { ...item, ...patch } : item)));
  const name = (base: string) => {
    let candidate = base;
    for (let n = 2; items.some((item) => item.name === candidate); n++) candidate = `${base} ${n}`;
    return candidate;
  };
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center border-b border-line-2 px-4 py-3 font-semibold">
        {props.title}
        {editable && (
          <button
            type="button"
            onClick={() => onChange([...items, { name: name(`New ${props.noun}`), query: '' }])}
            className="ml-auto inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-sans text-13 font-medium text-acc hover:text-acc-600"
          >
            <Icon name="plus" size={14} />
            {props.addLabel}
          </button>
        )}
      </div>
      <div className="flex flex-col px-4 py-1.5">
        {items.map((item, index) => (
          <div
            key={index}
            {...drag.item(index)}
            className={cx(
              'flex items-start gap-2.5 border-b border-line-2 py-2.5',
              drag.over === index && 'shadow-tab',
            )}
          >
            <span
              {...drag.handle(index, items.length)}
              {...(editable
                ? { tabIndex: 0, role: 'button', 'aria-label': `Move ${item.name}` }
                : {})}
              className={cx('flex pt-1.5 text-tx-3', editable && 'cursor-grab')}
            >
              <Icon name="drag" size={14} />
            </span>
            <input
              aria-label={`${props.noun} name`}
              value={item.name}
              readOnly={!editable}
              onChange={(event) => set(index, { name: event.target.value })}
              className="w-40 shrink-0 rounded-chip border border-line bg-card px-2 py-1.25 font-sans text-13 font-medium text-tx outline-0 focus:border-acc"
            />
            <LqlInput
              aria-label={`${item.name} query`}
              className="flex-1"
              value={item.query}
              readOnly={!editable}
              catalog={props.catalog}
              values={props.values}
              placeholder="priority = Highest"
              onChange={(query) => set(index, { query })}
            />
            {editable && (
              <button
                type="button"
                aria-label={`Remove ${item.name}`}
                onClick={() => onChange(items.filter((_, at) => at !== index))}
                className="flex cursor-pointer border-0 bg-transparent pt-1.5 text-tx-3 hover:text-tx-2"
              >
                <Icon name="close" size={13} />
              </button>
            )}
          </div>
        ))}
        <div className="py-2.5 text-12 text-tx-3">{props.footer}</div>
      </div>
    </Card>
  );
}
