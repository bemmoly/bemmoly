import { useDocumentTitle } from '@bemmoly/core-web';
import type { ReactNode } from 'react';
import { cx } from '../lib/cx.ts';

/**
 * A screen inside the shell's one scrolling area: the 20px title, quiet meta beside it,
 * actions at the end, then the body. Wide screens (tables, the access tree) take the full
 * content width; the rest stop at 1440px.
 */
export function Screen({
  title,
  meta,
  actions,
  children,
  className,
}: {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  useDocumentTitle([title, 'Pipelines']);
  return (
    <div
      className={cx('mx-auto flex w-full max-w-360 flex-col gap-4 px-4 py-5 md:px-6', className)}
    >
      <header className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-20 leading-title font-semibold text-tx">{title}</h1>
        {meta && <span className="text-13 text-tx-3">{meta}</span>}
        {actions && <div className="ms-auto flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

/** A titled card: the 16px heading, meta and actions on its row, then its content. */
export function Panel({
  title,
  meta,
  actions,
  children,
  flush = false,
  className,
  labelledBy,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** No padding under the title row: for tables and lists that draw their own rows. */
  flush?: boolean;
  className?: string;
  labelledBy?: string;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={cx(
        'flex min-w-0 flex-col rounded-card border border-line bg-card shadow-e1',
        className,
      )}
    >
      <div
        className={cx(
          'flex flex-wrap items-center gap-x-2 gap-y-1 px-4 pt-3.5',
          flush ? 'pb-2.5' : 'pb-1',
        )}
      >
        <h2 id={labelledBy} className="text-16 leading-title font-semibold text-tx">
          {title}
        </h2>
        {meta && <span className="text-12 text-tx-3">{meta}</span>}
        {actions && <div className="ms-auto flex items-center gap-2">{actions}</div>}
      </div>
      <div className={cx('flex min-w-0 flex-col', !flush && 'px-4 pb-4')}>{children}</div>
    </section>
  );
}
