import { productsOf, ProductSwitcher, START_PATH } from '@bemmoly/core-web';
import { queryKeys } from '@bemmoly/api-client';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.ts';

const BUTTON =
  'grid size-8 shrink-0 cursor-pointer place-items-center rounded-control border-0 bg-transparent p-0 text-tx-2 hover:bg-hover hover:text-tx focus-ring';

/**
 * The grid button: back to the start page or across to another product the person can use.
 * Every destination is another app (or Pipelines' own front door), so each is a page load.
 */
export function ProductSwitch() {
  const { data = [] } = useQuery({
    queryKey: queryKeys.modules(),
    queryFn: () => api.modules.list(),
  });
  return (
    <ProductSwitcher
      products={productsOf(data)}
      currentId="pipelines"
      onOpen={(path) => window.location.assign(path)}
      startPath={START_PATH}
      className={BUTTON}
    />
  );
}
