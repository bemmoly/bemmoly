import { useEffect, useId, useRef, type ReactNode } from 'react';

/** PLACEHOLDER for @bemmoly/ui Modal: scrim, 12px-radius panel, title, body, footer. */
export interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'sm' | 'md' | 'lg';
}

const WIDTHS = { sm: 'w-105', md: 'w-130', lg: 'w-180' } as const;

export function Modal({ open, title, onClose, children, footer, width = 'md' }: ModalProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>('input, select, textarea, button');
    (first ?? panel.current)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-scrim p-6" onMouseDown={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
        className={`flex max-h-full max-w-full flex-col overflow-hidden rounded-dialog bg-sf shadow-pop outline-none ${WIDTHS[width]}`}
      >
        <h2
          id={titleId}
          className="m-0 border-b border-br2 px-5 py-4 text-wordmark font-semibold text-tx"
        >
          {title}
        </h2>
        <div className="flex flex-col gap-4 overflow-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-br2 bg-head-bg px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
