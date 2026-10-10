import { Fragment, type ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { Breadcrumbs, type BreadcrumbsProps, type Crumb } from '../breadcrumbs/breadcrumbs.tsx';

export interface PageTitleProps {
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

/**
 * The title block at the top of a page's content: a 20px title, its facts and a sentence. The
 * frame's page header (core-web) holds the trail and the page actions, so new pages leave
 * `breadcrumbs` and `actions` out.
 */
export function PageTitle({
  breadcrumbs,
  linkAs,
  title,
  meta,
  description,
  actions,
  variant = 'page',
  className,
}: PageTitleProps) {
  const settings = variant === 'settings';
  return (
    <header className={cx('flex flex-col', settings ? 'gap-1.5' : 'gap-3', className)}>
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} {...(linkAs ? { linkAs } : {})} />}
      <div
        className={cx('flex flex-wrap gap-x-4 gap-y-2', settings ? 'items-center' : 'items-start')}
      >
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="m-0 text-20 font-semibold tracking-title text-balance">{title}</h1>
          {meta && meta.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-13 text-tx-3">
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
      {description && <p className="m-0 max-w-160 text-13 leading-body text-tx-3">{description}</p>}
    </header>
  );
}
