import { useId, type ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { useDialog } from '../../lib/use-dialog.ts';
import { IconButton } from '../button/icon-button.tsx';

export type ModalWidth = 'sm' | 'md' | 'lg' | 'xl';

/** 760 is the command palette; the narrower widths follow the 8px rhythm of the mocks. */
const WIDTHS: Record<ModalWidth, string> = { sm: 'w-100', md: 'w-120', lg: 'w-160', xl: 'w-190' };

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** One line under the title. */
  description?: ReactNode;
  children?: ReactNode;
  /** Buttons, right-aligned on the tinted footer bar. Put the primary action last. */
  footer?: ReactNode;
  width?: ModalWidth;
  className?: string;
}

/**
 * No mock shows a generic modal; it reuses the command palette surface (12px radius, its
 * shadow and scrim) with the palette's header and footer bars.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'md',
  className,
}: ModalProps) {
  const { ref, onBackdropClick } = useDialog(open, onClose);
  const titleId = useId();
  const descId = useId();
  if (!open) return null;
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClick={onBackdropClick}
      className={cx(
        'm-auto max-h-[calc(100vh-96px)] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-dialog border-0 bg-sf p-0 text-13 text-tx shadow-modal open:flex',
        'backdrop:bg-scrim',
        WIDTHS[width],
        className,
      )}
    >
      <div className="flex items-start gap-3 border-b border-br2 px-4 py-3.5">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 id={titleId} className="m-0 text-14 font-semibold">
            {title}
          </h2>
          {description && (
            <p id={descId} className="m-0 text-12h leading-body text-tx4">
              {description}
            </p>
          )}
        </div>
        <IconButton
          label="Close"
          icon="close"
          size="xs"
          onClick={onClose}
          className="-my-1 -mr-1.5"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
      {footer && (
        <div className="flex items-center justify-end gap-2 border-t border-br2 bg-sf2 px-4 py-2.5">
          {footer}
        </div>
      )}
    </dialog>
  );
}
