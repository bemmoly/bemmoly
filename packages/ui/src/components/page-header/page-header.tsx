import { Fragment, type ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { Breadcrumbs, type BreadcrumbsProps, type Crumb } from '../breadcrumbs/breadcrumbs.tsx';

export interface PageHeaderProps {
  breadcrumbs?: readonly Crumb[];
  linkAs?: BreadcrumbsProps['linkAs'];
  title: ReactNode;
  /** Facts under the title, joined by "·" (Board: dates, days remaining, goal). */
  meta?: readonly ReactNode[];
  /** A sentence under the title row (settings pages). */
  description?: ReactNode;
  /** Right-aligned buttons, 8px apart. */
  actions?: ReactNode;
  /**
   * page: Board and Backlog (12px between rows, actions top-aligned with the title block).
   * settings: Workspace and project settings (6px between rows, actions centred on the title).
   */
  variant?: 'page' | 'settings';
  className?: string;
}

/** "Projects / Platform Core / Board", a 22px title, its facts and the page actions. */
export function PageHeader({
  breadcrumbs,
  linkAs,
  title,
  meta,
  description,
  actions,
  variant = 'page',
  className,
}: PageHeaderProps) {
  const settings = variant === 'settings';
  return (
    <header className={cx('flex flex-col', settings ? 'gap-1.5' : 'gap-3', className)}>
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} {...(linkAs ? { linkAs } : {})} />}
      <div className={cx('flex gap-4', settings ? 'items-center' : 'items-start')}>
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="m-0 text-22 font-semibold tracking-title whitespace-nowrap">{title}</h1>
          {meta && meta.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-12h text-tx4">
              {meta.map((item, index) => (
                <Fragment key={index}>
                  {index > 0 && <span aria-hidden>·</span>}
                  <span>{item}</span>
                </Fragment>
              ))}
            </div>
          )}
        </div>
        {actions && (
          <div className="ml-auto flex shrink-0 items-center gap-2 whitespace-nowrap">
            {actions}
          </div>
        )}
      </div>
      {description && <p className="m-0 max-w-160 text-13 leading-body text-tx4">{description}</p>}
    </header>
  );
}
