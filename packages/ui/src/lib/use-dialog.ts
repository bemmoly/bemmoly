import { useEffect, useLayoutEffect, useRef, type MouseEvent } from 'react';

/**
 * Drives a native <dialog> from `open`: showModal() gives focus containment, an inert page and
 * the top layer for free. Escape and a click on the backdrop call onClose; focus returns to
 * whatever had it before opening.
 */
export function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  useLayoutEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      const previous = document.activeElement as HTMLElement | null;
      dialog.showModal();
      return () => {
        if (dialog.open) dialog.close();
        previous?.focus?.();
      };
    }
    return undefined;
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onCancel = (event: Event) => {
      event.preventDefault();
      closeRef.current();
    };
    dialog.addEventListener('cancel', onCancel);
    return () => dialog.removeEventListener('cancel', onCancel);
  }, [open]);

  /** Spread on the <dialog>: a click whose target is the dialog itself landed on the backdrop. */
  const onBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) closeRef.current();
  };

  return { ref, onBackdropClick };
}
