import { ModuleTile, useFrameLink, type Product } from '@bemmoly/core-web';
import { RelativeTime, SkeletonRow } from '@bemmoly/ui';
import type { ReactNode } from 'react';
import type { StartRow } from '../../hooks/use-start-summaries.ts';

function Row({
  row,
  product,
  trailing,
}: {
  row: StartRow;
  product: Product | undefined;
  trailing: ReactNode;
}) {
  const link = useFrameLink(row.path);
  return (
    <a
      {...link}
      className="flex items-center gap-2.5 border-b border-line-2 px-3.5 py-2.25 text-13 text-tx no-underline last:border-b-0 hover:bg-hover focus-ring-inset"
    >
      {product ? <ModuleTile manifest={product.manifest} size={18} /> : null}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate" title={row.title}>
          {row.handle ? (
            <span className="mr-1.5 font-mono text-11 text-tx-3">{row.handle}</span>
          ) : null}
          {row.title}
        </span>
        {row.context ? <span className="truncate text-12 text-tx-3">{row.context}</span> : null}
      </span>
      <span className="shrink-0 text-12 text-tx-3">{trailing}</span>
    </a>
  );
}

export interface StartListProps {
  id: string;
  title: string;
  /** Beside the title: "3 across 2 products". */
  meta?: string;
  rows: readonly StartRow[];
  products: readonly Product[];
  loading: boolean;
  /** Shown in place of rows when there are none. */
  empty: string;
  /** What a row ends with: when it is due, when it changed, or where it opens. */
  trailing: (row: StartRow, product: Product | undefined) => ReactNode;
}

/** A card of rows from every product: "Needs you" and "Recent". Each row opens its product. */
export function StartList({
  id,
  title,
  meta,
  rows,
  products,
  loading,
  empty,
  trailing,
}: StartListProps) {
  const productOf = (moduleId: string) => products.find((product) => product.id === moduleId);
  return (
    <section aria-labelledby={id} className="overflow-hidden rounded-card bg-card shadow-e1">
      <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
        <h2 id={id} className="m-0 flex-1 text-13 font-semibold">
          {title}
        </h2>
        {meta ? <span className="text-12 text-tx-3">{meta}</span> : null}
      </div>
      {loading ? (
        <div aria-busy aria-label={`Loading ${title.toLowerCase()}`}>
          {[0, 1, 2].map((index) => (
            <SkeletonRow key={index} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="m-0 px-3.5 py-6 text-center text-13 text-tx-3">{empty}</p>
      ) : (
        rows.map((row) => {
          const product = productOf(row.moduleId);
          return (
            <Row
              key={`${row.moduleId}:${row.id}`}
              row={row}
              product={product}
              trailing={trailing(row, product)}
            />
          );
        })
      )}
    </section>
  );
}

/** A recent row ends with when it changed. */
export const changedAt = (row: StartRow) => (row.at ? <RelativeTime iso={row.at} /> : null);
