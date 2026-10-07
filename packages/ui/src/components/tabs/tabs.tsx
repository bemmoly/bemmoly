import { useId, useRef, type HTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { focusRingInset } from '../../lib/focus.ts';

export type TabsSize = 'md' | 'sm' | 'panel';

/**
 * md: Board Settings (9px 14px). sm: card header tabs on Home (11px 10px).
 * panel: the Doc Editor side panel (12px 10px, 12.5px).
 */
const SIZES: Record<TabsSize, string> = {
  md: 'px-3.5 py-2.25',
  sm: 'px-2.5 py-2.75',
  panel: 'px-2.5 py-3 text-12h',
};

export interface TabItem<V extends string> {
  value: V;
  label: ReactNode;
  /** Mono count in tx5 after the label (Home). */
  count?: number;
  /** Accent pill after the label (Board Settings "2 locked"). */
  badge?: ReactNode;
}

export interface TabsProps<V extends string> {
  items: readonly TabItem<V>[];
  value: V;
  onChange: (value: V) => void;
  size?: TabsSize;
  /** Draws the br rule under the row; off when the tabs sit in a card header with its own rule. */
  bordered?: boolean;
  'aria-label'?: string;
  /** Prefix for tab and panel ids; pass it when you render TabPanels so tabs control them. */
  idPrefix?: string;
  /** Content after the tabs, pushed right ("View all" on Home). */
  end?: ReactNode;
  className?: string;
}

export const tabId = (prefix: string, value: string) => `${prefix}-tab-${value}`;
export const panelId = (prefix: string, value: string) => `${prefix}-panel-${value}`;

/** Underline tabs: medium weight, tx4; the selected tab is tx with a 2px inset accent rule. */
export function Tabs<V extends string>({
  items,
  value,
  onChange,
  size = 'md',
  bordered = true,
  idPrefix,
  end,
  className,
  ...aria
}: TabsProps<V>) {
  const generated = useId();
  const prefix = idPrefix ?? generated;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const target = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: items.length - 1 }[
      event.key
    ];
    if (target === undefined) return;
    event.preventDefault();
    const next = (target + items.length) % items.length;
    const item = items[next];
    if (!item) return;
    onChange(item.value);
    refs.current[next]?.focus();
  };
  return (
    <div className={cx('flex items-center gap-0.5', bordered && 'border-b border-br', className)}>
      <div role="tablist" {...aria} className="flex gap-0.5">
        {items.map((item, index) => {
          const selected = item.value === value;
          return (
            <button
              key={item.value}
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={tabId(prefix, item.value)}
              aria-selected={selected}
              aria-controls={idPrefix ? panelId(prefix, item.value) : undefined}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(item.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cx(
                'flex cursor-pointer items-center gap-1.5 border-0 bg-transparent font-sans font-medium whitespace-nowrap',
                SIZES[size],
                selected ? 'text-tx shadow-tab' : 'text-tx4 hover:text-tx2',
                focusRingInset,
              )}
            >
              {item.label}
              {item.count !== undefined && (
                <span className="font-mono text-11 font-medium text-tx5">{item.count}</span>
              )}
              {item.badge !== undefined && (
                <span className="rounded-pill bg-ac-bg px-1.5 py-px font-mono text-10h font-medium text-ac">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {end && <div className="ml-auto flex items-center">{end}</div>}
    </div>
  );
}

export interface TabPanelProps extends HTMLAttributes<HTMLDivElement> {
  idPrefix: string;
  value: string;
}

export function TabPanel({ idPrefix, value, ...rest }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      id={panelId(idPrefix, value)}
      aria-labelledby={tabId(idPrefix, value)}
      tabIndex={0}
      {...rest}
    />
  );
}
