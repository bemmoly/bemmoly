import { Fragment, type ElementType, type ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';

export interface Crumb {
  label: ReactNode;
  /** Makes the crumb a link (accent, as in the Issue and Doc Editor mocks). */
  href?: string;
  /** Extra props for the link component, e.g. a router's `to`. */
  linkProps?: Record<string, unknown>;
  /** Leading mark: an epic square, a type glyph, a key. */
  icon?: ReactNode;
}

export interface BreadcrumbsProps {
  items: readonly Crumb[];
  /** Router link component; defaults to <a>. */
  linkAs?: ElementType;
  /** Medium weight on the current page, as in the Doc Editor header. */
  strongCurrent?: boolean;
  className?: string;
}

/** 12.5px tx4 trail, 6px apart with "/" separators; the current page is tx. */
export function Breadcrumbs({
  items,
  linkAs: Link = 'a',
  strongCurrent,
  className,
}: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0 text-12h text-tx4">
        {items.map((item, index) => {
          const current = index === items.length - 1;
          const content = (
            <>
              {item.icon}
              {item.label}
            </>
          );
          return (
            <Fragment key={index}>
              {index > 0 && (
                <li aria-hidden className="text-tx4">
                  /
                </li>
              )}
              <li className="flex items-center gap-1.25">
                {current ? (
                  <span
                    aria-current="page"
                    className={cx(
                      'flex items-center gap-1.25 text-tx',
                      strongCurrent && 'font-medium',
                    )}
                  >
                    {content}
                  </span>
                ) : item.href || item.linkProps ? (
                  <Link
                    href={item.href}
                    {...item.linkProps}
                    className={cx(
                      'flex items-center gap-1.25 text-ac no-underline hover:text-ac-d',
                      focusRing,
                    )}
                  >
                    {content}
                  </Link>
                ) : (
                  <span className="flex items-center gap-1.25">{content}</span>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
