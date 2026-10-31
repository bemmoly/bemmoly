import { useT } from '@bemmoly/core-web';
import type { ExportConnection } from '@bemmoly/module-pipelines/shared';
import { Button } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { Panel } from '../../../parts/screen.tsx';

/** A short list under its own heading, one sentence per line. */
export function Sentences({ title, items }: { title: string; items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-13 font-semibold text-tx">{title}</h3>
      <ul aria-label={title} className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item} className="text-12 text-tx-2">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * One connection's directory in the export: what it holds, its files, what to fill in before
 * a plan and what was left out. Download takes this connection alone.
 */
export function ExportCard({
  item,
  busy,
  onDownload,
}: {
  item: ExportConnection;
  busy: boolean;
  onDownload: () => void;
}) {
  const t = useT(pipelinesText);
  const { counts } = item;
  const prefix = `${item.directory}/`;
  return (
    <Panel
      labelledBy={`export-${item.connection.id}`}
      title={item.connection.name}
      meta={t('pipelines.export.meta', {
        mode: t(`pipelines.export.mode.${item.connection.mode}`),
        projects: counts.projects,
        services: counts.services,
        charts: counts.charts,
        secrets: counts.secrets,
      })}
      actions={
        <Button size="xs" variant="secondary" loading={busy} onClick={onDownload}>
          <Icon name="download" size={14} />
          {t('pipelines.export.downloadOne')}
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-1.5">
          <h3 className="text-13 font-semibold text-tx">
            {t('pipelines.export.files', { directory: prefix })}
          </h3>
          <ul
            aria-label={t('pipelines.export.filesLabel', { name: item.connection.name })}
            className="flex flex-col gap-0.5"
          >
            {item.files.map((file) => (
              <li key={file} className="truncate font-mono text-12 text-tx-2">
                {file.startsWith(prefix) ? file.slice(prefix.length) : file}
              </li>
            ))}
          </ul>
        </section>
        <div className="flex min-w-0 flex-col gap-4">
          <Sentences title={t('pipelines.export.toFill')} items={item.toFill} />
          <Sentences title={t('pipelines.export.leftOut')} items={item.leftOut} />
        </div>
      </div>
    </Panel>
  );
}
