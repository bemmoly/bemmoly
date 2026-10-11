import { FloatingLayer, usePresence } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { useFrame } from './frame-context.ts';

export interface SwitcherItem {
  id: string;
  label: string;
  /** Matched by the search too: a project key, a space key. */
  hint?: string;
  icon?: ReactNode;
  path: string;
}

export interface SwitcherTriggerProps {
  ref: Ref<HTMLButtonElement>;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent) => void;
  'aria-haspopup': 'listbox';
  'aria-expanded': boolean;
}

export interface SwitcherMenuProps {
  trigger: (props: SwitcherTriggerProps) => ReactNode;
  items: readonly SwitcherItem[];
  currentId?: string;
  /** What the search box says, e.g. "Switch project…". */
  placeholder: string;
  /** Fixed rows under the list ("All projects"). */
  footer?: readonly SwitcherItem[];
}

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * A searchable menu of places, for a breadcrumb that switches (the project crumb): type to
 * narrow, arrows to move, Enter to go, Escape to close with focus back on the crumb.
 */
export function SwitcherMenu({
  trigger,
  items,
  currentId,
  placeholder,
  footer = [],
}: SwitcherMenuProps) {
  const { navigate } = useFrame();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const layer = useRef<HTMLDivElement>(null);
  const listId = useId();
  const presence = usePresence(open);

  const shown = useMemo(() => {
    const q = fold(query.trim());
    const found = q
      ? items.filter((item) => fold(`${item.label} ${item.hint ?? ''}`).includes(q))
      : items;
    return [...found, ...footer];
  }, [items, footer, query]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!anchor?.contains(target) && !layer.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, anchor]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) anchor?.focus();
  };
  const choose = (item: SwitcherItem | undefined) => {
    if (!item) return;
    close(false);
    navigate(item.path);
  };
  const show = () => {
    setQuery('');
    setActive(
      Math.max(
        0,
        items.findIndex((item) => item.id === currentId),
      ),
    );
    setOpen(true);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((index) => (index + step + shown.length) % Math.max(1, shown.length));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(shown[active]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') close(false);
  };

  return (
    <>
      {trigger({
        ref: setAnchor,
        onClick: () => (open ? close(false) : show()),
        onKeyDown: (event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            show();
          }
        },
        'aria-haspopup': 'listbox',
        'aria-expanded': open,
      })}
      {presence.mounted && (
        <FloatingLayer
          ref={layer}
          anchor={anchor}
          data-state={presence.leaving ? 'closed' : 'open'}
          className="w-68 overflow-hidden"
        >
          <div className="flex items-center gap-2 border-b border-line px-3 text-tx-3">
            <Icon name="search" size={14} />
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              aria-label={placeholder}
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
              className="h-9 min-w-0 flex-1 border-0 bg-transparent font-sans text-13 text-tx outline-none placeholder:text-tx-3"
            />
          </div>
          <div
            role="listbox"
            id={listId}
            aria-label={placeholder}
            className="max-h-72 overflow-y-auto p-1.5"
          >
            {query && shown.length === footer.length ? (
              <p className="m-0 px-2.5 py-2 text-12 text-tx-3">Nothing matches “{query}”.</p>
            ) : null}
            {shown.map((item, index) => (
              <div key={`${item.id}-${index}`}>
                {index === shown.length - footer.length && index > 0 ? (
                  <div role="separator" className="my-1 border-t border-line" />
                ) : null}
                <div
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  onPointerMove={() => setActive(index)}
                  onClick={() => choose(item)}
                  className={`flex h-8 cursor-pointer items-center gap-2 rounded-chip px-2.5 text-13 ${
                    index === active ? 'bg-hover text-tx' : 'text-tx-2'
                  }`}
                >
                  {item.icon}
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.hint ? (
                    <span className="font-mono text-11 text-tx-3">{item.hint}</span>
                  ) : null}
                  {item.id === currentId ? (
                    <Icon name="check" size={14} className="text-acc" />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </FloatingLayer>
      )}
    </>
  );
}
