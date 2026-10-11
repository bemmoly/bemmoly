import { useId, type ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { DIALOG_MOTION } from '../../lib/motion.ts';
import { usePresence } from '../../lib/presence.ts';
import { useDialog } from '../../lib/use-dialog.ts';
import { IconButton } from '../button/icon-button.tsx';

export type ModalWidth = 'sm' | 'md' | 'lg' | 'composer' | 'xl';

/**
 * sm 400 (a confirmation), md 480 (a short form), lg 640 (a form with a list), composer 720
 * (Create issue, the review's width), xl 760 (a side-by-side comparison).
 */
const WIDTHS: Record<ModalWidth, string> = {
  sm: 'w-100',
  md: 'w-120',
  lg: 'w-160',
  composer: 'w-180',
  xl: 'w-190',
};

/**
 * Under 640px the dialog is a full-screen sheet: no margin, no radius, the footer held above
 * the home indicator.
 */
const SHEET =
  'max-sm:m-0 max-sm:h-dvh max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:rounded-none';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** The dialog's name. With `header`, it is kept for assistive tech only. */
  title: ReactNode;
  /** One line under the title. */
  description?: ReactNode;
  /**
   * Replaces the title bar, for dialogs whose first line is a control (Create issue's project
   * and type pickers). The dialog stays named by `title`; include a Close button.
   */
  header?: ReactNode;
  children?: ReactNode;
  /**
   * Buttons, right-aligned on the sunken footer bar. Put the primary action last. The footer
   * sits outside the scrolling body, so it never scrolls away.
   */
  footer?: ReactNode;
  width?: ModalWidth;
  /** Drop the body's padding, for content that draws its own edges. */
  flush?: boolean;
  className?: string;
}

/**
 * The one dialog: a native <dialog> on the top layer (focus held inside, the page inert, focus
 * returned to the opener on close), card surface with e3 elevation and a flat scrim with no
 * blur. It rises in over 180ms and sinks out in 100ms, and is still under reduced motion.
 * Escape and a click on the scrim call onClose, so a dialog with unsaved work can ask first.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  header,
  children,
  footer,
  width = 'md',
  flush = false,
  className,
}: ModalProps) {
  const presence = usePresence(open);
  const { ref, onBackdropClick } = useDialog(presence.mounted, onClose);
  const titleId = useId();
  const descId = useId();
  if (!presence.mounted) return null;
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClick={onBackdropClick}
      data-state={presence.leaving ? 'closed' : 'open'}
      className={cx(
        'm-auto max-h-[calc(100vh-96px)] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-dialog border-0 bg-card p-0 text-13 text-tx shadow-e3 open:flex',
        'backdrop:bg-scrim',
        DIALOG_MOTION,
        WIDTHS[width],
        SHEET,
        className,
      )}
    >
      {header ? (
        <>
          <h2 id={titleId} className="sr-only">
            {title}
          </h2>
          {description && (
            <p id={descId} className="sr-only">
              {description}
            </p>
          )}
          {header}
        </>
      ) : (
        <div className="flex shrink-0 items-start gap-3 border-b border-line px-4 py-3.5">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 id={titleId} className="m-0 text-14 font-semibold">
              {title}
            </h2>
            {description && (
              <p id={descId} className="m-0 text-12 leading-body text-tx-3">
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
      )}
      <div className={cx('min-h-0 flex-1 overflow-auto overscroll-contain', !flush && 'p-4')}>
        {children}
      </div>
      {footer && (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line bg-sunken px-4 py-2.5 max-sm:pb-[max(10px,env(safe-area-inset-bottom))]">
          {footer}
        </div>
      )}
    </dialog>
  );
}
