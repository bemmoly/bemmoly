import { useT } from '@bemmoly/core-web';
import { TableSkeleton } from '@bemmoly/ui';
import { pipelinesText } from '../i18n/catalog.ts';

/** A table's rows while they load: the first column wide, the rest even, as the tables draw. */
export function RowsSkeleton({ columns = 4, rows = 5 }: { columns?: number; rows?: number }) {
  const t = useT(pipelinesText);
  return (
    <TableSkeleton
      label={t('pipelines.common.loading')}
      rows={rows}
      columns={Array.from({ length: columns }, (_, index) => ({
        width: index === 0 ? 'minmax(0,1.6fr)' : 'minmax(0,1fr)',
      }))}
    />
  );
}
