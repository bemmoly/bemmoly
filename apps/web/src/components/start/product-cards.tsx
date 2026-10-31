import { ModuleTile, useFrameLink, type Product } from '@bemmoly/core-web';
import type { StartSummary } from '@bemmoly/shared';
import { Skeleton } from '@bemmoly/ui';

type Waiting = StartSummary['waiting'];

function waitingLine(waiting: Waiting | undefined, loading: boolean): string {
  if (waiting === undefined) return loading ? '' : 'Open';
  if (waiting === null || waiting.count === 0) return 'Nothing waiting';
  return `${waiting.count} ${waiting.label}`;
}

const CARD =
  'flex min-w-0 items-center gap-3 rounded-card bg-card p-3.5 text-tx no-underline shadow-e1 hover:shadow-e1h focus-ring motion-safe:transition-shadow';

function ProductCard({
  product,
  waiting,
  loading,
}: {
  product: Product;
  waiting: Waiting | undefined;
  loading: boolean;
}) {
  const link = useFrameLink(product.path);
  // A product with its own app is another page load, never a route in this one.
  const props = product.ownApp ? { href: product.path } : link;
  const count = waiting?.count ?? 0;
  return (
    <a {...props} className={CARD} data-testid={`start-product-${product.id}`}>
      <ModuleTile manifest={product.manifest} size={28} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-medium">{product.name}</span>
        <span className="truncate text-12 text-tx-3">
          {loading && waiting === undefined ? (
            <Skeleton width={96} height={10} />
          ) : (
            waitingLine(waiting, loading)
          )}
        </span>
      </span>
      {count > 0 ? (
        <span className="rounded-full bg-acc-fill px-1.5 text-11 leading-4.25 font-semibold text-on-acc tabular-nums">
          {count}
        </span>
      ) : null}
    </a>
  );
}

/** "Your products": one card per product the person can use, with what waits there. */
export function ProductCards({
  products,
  waiting,
  loading,
}: {
  products: readonly Product[];
  waiting: ReadonlyMap<string, Waiting>;
  loading: boolean;
}) {
  return (
    <section aria-labelledby="start-products" className="flex flex-col gap-2.5">
      <h2 id="start-products" className="m-0 text-13 font-semibold text-tx-2">
        Your products
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            waiting={waiting.get(product.id)}
            loading={loading}
          />
        ))}
      </div>
    </section>
  );
}
