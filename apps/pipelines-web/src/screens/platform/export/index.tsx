import { useT } from '@bemmoly/core-web';
import { Button, EmptyState, useToast } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useExportDownload, useExportPreview } from '../../../hooks/use-exports.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { ActionError } from '../../../parts/action-error.tsx';
import { Area } from '../../../parts/area.tsx';
import { LoadFailed } from '../../../parts/load-failed.tsx';
import { RowsSkeleton } from '../../../parts/rows-skeleton.tsx';
import { Panel } from '../../../parts/screen.tsx';
import { ExportCard } from './export-card.tsx';

/**
 * Platform › Export: everything Pipelines created, as Terraform and Helm a company can run
 * without it. Each connection is a directory in one zip; the page shows what each holds, what
 * to fill in before a plan and what stays out, before anything is downloaded.
 */
export default function ExportArea() {
  const t = useT(pipelinesText);
  const preview = useExportPreview();
  const download = useExportDownload();
  const toast = useToast();
  const start = (connection?: string) =>
    download.mutate(connection ? { connection } : {}, {
      onSuccess: (bundle) =>
        toast.show({ tone: 'ok', title: t('pipelines.export.started', { file: bundle.fileName }) }),
    });
  const items = preview.data?.items ?? [];
  const leftOut = preview.data?.leftOut ?? [];
  const busyFor = (connection?: string) =>
    download.isPending && download.variables?.connection === connection;
  return (
    <Area
      title={t('pipelines.platform.export')}
      meta={t('pipelines.export.intro')}
      actions={
        <Button
          variant="primary"
          disabled={items.length === 0}
          loading={busyFor(undefined)}
          onClick={() => start()}
        >
          <Icon name="download" size={14} />
          {t('pipelines.export.download')}
        </Button>
      }
    >
      <ActionError error={download.error} />
      {preview.isError ? (
        <LoadFailed error={preview.error} onRetry={() => void preview.refetch()} />
      ) : !preview.data ? (
        <RowsSkeleton columns={2} rows={4} />
      ) : items.length === 0 ? (
        <div className="rounded-card border border-line bg-card py-10">
          <EmptyState
            icon={<Icon name="download" size={18} />}
            title={t('pipelines.export.emptyTitle')}
            description={t('pipelines.export.emptyDescription')}
            headingLevel={2}
          />
        </div>
      ) : (
        items.map((item) => (
          <ExportCard
            key={item.connection.id}
            item={item}
            busy={busyFor(item.connection.id)}
            onDownload={() => start(item.connection.id)}
          />
        ))
      )}
      {leftOut.length > 0 && (
        <Panel title={t('pipelines.export.elsewhere')}>
          <ul aria-label={t('pipelines.export.elsewhere')} className="flex flex-col gap-1">
            {leftOut.map((line) => (
              <li key={line} className="text-12 text-tx-2">
                {line}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </Area>
  );
}
