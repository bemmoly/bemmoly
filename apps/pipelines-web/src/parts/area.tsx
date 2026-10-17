import { useDocumentTitle, useT } from '@bemmoly/core-web';
import type { ReactNode } from 'react';
import { pipelinesText } from '../i18n/catalog.ts';
import { cx } from '../lib/cx.ts';

/**
 * A Platform area under the platform's title and tabs: its quiet meta and actions on one row,
 * then its body. The tab names the area, so the row repeats it only for assistive tech.
 */
export function Area({
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
  const t = useT(pipelinesText);
  useDocumentTitle([title, t('pipelines.platform.title'), 'Pipelines']);
  return (
    <div
      className={cx('mx-auto flex w-full max-w-360 flex-col gap-4 px-4 py-4 md:px-6', className)}
    >
      {(meta || actions) && (
        <div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="sr-only">{title}</h2>
          {meta && <span className="text-13 text-tx-3">{meta}</span>}
          {actions && <div className="ms-auto flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
