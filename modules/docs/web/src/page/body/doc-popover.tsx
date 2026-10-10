import { FloatingLayer, usePresence } from '@bemmoly/ui';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { cx } from '../cx.ts';

export interface PopoverTriggerProps {
  ref: Ref<HTMLButtonElement>;
  onClick: () => void;
  'aria-haspopup': 'dialog';
  'aria-expanded': boolean;
  'aria-controls': string | undefined;
}

export interface DocPopoverProps {
  /** Renders the control that opens it; spread the props onto a button. */
  trigger: (props: PopoverTriggerProps) => ReactNode;
  /** The popover's accessible name: "Page icon". */
  label: string;
  /** The content; `close` hands focus back to the trigger. */
  children: (close: () => void) => ReactNode;
  align?: 'start' | 'end';
  className?: string;
}

const FOCUSABLE = 'button:not([disabled]),input:not([disabled]),[tabindex="0"],a[href]';

/**
 * A small non-modal dialog hung from its trigger, for editing a value where it is shown (the
 * page icon, the cover, a property, who can see the page). It scales in from the trigger,
 * takes focus on its first control, and closes on Escape (focus back on the trigger) or on a
 * click outside (focus left where the click put it).
 */
export function DocPopover({
  trigger,
  label,
  children,
  align = 'start',
  className,
}: DocPopoverProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const layer = useRef<HTMLDivElement>(null);
  const id = useId();
  const presence = usePresence(open);

  const close = () => {
    setOpen(false);
    anchor?.focus();
  };

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!anchor?.contains(target) && !layer.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, anchor]);

  useEffect(() => {
    if (open) layer.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, [open]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    close();
  };

  return (
    <>
      {trigger({
        ref: setAnchor,
        onClick: () => setOpen((value) => !value),
        'aria-haspopup': 'dialog',
        'aria-expanded': open,
        'aria-controls': open ? id : undefined,
      })}
      {presence.mounted && (
        <FloatingLayer
          ref={layer}
          id={id}
          role="dialog"
          aria-label={label}
          anchor={anchor}
          align={align}
          data-state={presence.leaving ? 'closed' : 'open'}
          onKeyDown={onKeyDown}
          className={cx('overflow-auto p-1.5', className)}
        >
          {children(close)}
        </FloatingLayer>
      )}
    </>
  );
}
