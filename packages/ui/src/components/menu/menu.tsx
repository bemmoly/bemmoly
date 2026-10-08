import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { cx } from '../../lib/cx.ts';
import { FloatingLayer } from '../../lib/floating.tsx';
import { MenuContext } from './menu-context.ts';

export interface MenuTriggerProps {
  ref: Ref<HTMLButtonElement>;
  id: string;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent) => void;
  'aria-haspopup': 'menu';
  'aria-expanded': boolean;
  'aria-controls': string | undefined;
}

export interface MenuProps {
  /** Renders the button that opens the menu; spread the props onto it. */
  trigger: (props: MenuTriggerProps) => ReactNode;
  children: ReactNode;
  align?: 'start' | 'end';
  /** Start open, e.g. to show the menu in a story or a screenshot. */
  defaultOpen?: boolean;
  /**
   * Tailwind width classes. By default the menu fits its content between 180px and 320px; the
   * Doc Editor's slash menu is a fixed 320px (`w-80`).
   */
  widthClassName?: string;
  className?: string;
}

const ITEM_SELECTOR = '[role="menuitem"]:not([aria-disabled="true"])';

const itemsIn = (menu: HTMLElement | null) => [
  ...(menu?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []),
];

/** Moves focus to the first (or last) item once the portalled menu is in the document. */
function FocusOnOpen({ menuId, last }: { menuId: string; last: boolean }) {
  useEffect(() => {
    const list = itemsIn(document.getElementById(menuId));
    (last ? list.at(-1) : list[0])?.focus();
  }, [menuId, last]);
  return null;
}

/**
 * The popover menu of the Doc Editor: 8px radius, br border, shadow-menu, 6px padding. It is
 * portalled out of its trigger's container, so a table card or drawer never clips it. Arrow
 * keys, Home and End move between items, Enter and Space choose, Escape closes and returns
 * focus to the trigger, Tab and a click outside close.
 */
export function Menu({
  trigger,
  children,
  align = 'start',
  widthClassName = 'min-w-45 max-w-80',
  defaultOpen = false,
  className,
}: MenuProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [focusLast, setFocusLast] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerId = useId();
  const menuId = useId();

  const close = useCallback(
    (refocus = true) => {
      setOpen(false);
      if (refocus) anchor?.focus();
    },
    [anchor],
  );

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) close(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, close]);

  const onTriggerKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setFocusLast(event.key === 'ArrowUp');
      setOpen(true);
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent) => {
    const list = itemsIn(menuRef.current);
    const index = list.indexOf(document.activeElement as HTMLElement);
    const move = (to: number) => {
      event.preventDefault();
      list[(to + list.length) % list.length]?.focus();
    };
    if (event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowUp') move(index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(list.length - 1);
    else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') close(false);
  };

  return (
    <div ref={rootRef} className={cx('relative inline-flex', className)}>
      {trigger({
        ref: setAnchor,
        id: triggerId,
        onClick: () => {
          setFocusLast(false);
          setOpen((value) => !value);
        },
        onKeyDown: onTriggerKeyDown,
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': open ? menuId : undefined,
      })}
      {open && (
        <MenuContext.Provider value={{ close }}>
          <FloatingLayer
            ref={menuRef}
            anchor={anchor}
            align={align}
            id={menuId}
            role="menu"
            aria-labelledby={triggerId}
            onKeyDown={onMenuKeyDown}
            className={cx('overflow-y-auto p-1.5', widthClassName)}
          >
            {children}
            <FocusOnOpen menuId={menuId} last={focusLast} />
          </FloatingLayer>
        </MenuContext.Provider>
      )}
    </div>
  );
}
