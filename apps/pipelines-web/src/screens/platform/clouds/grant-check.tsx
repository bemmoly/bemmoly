import { useT } from '@bemmoly/core-web';
import type { CloudConnection } from '@bemmoly/module-pipelines/shared';
import { Button, RunGlyph } from '@bemmoly/ui';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { CONNECTION_GLYPH } from './connection-card.tsx';

/**
 * Whether the folder grant is in place: who Bemmoly is, and each permission it lacks on the
 * folder or the billing account as one sentence saying what to grant. Nothing can be created
 * until it passes, so Check again sits beside the problems.
 */
export function GrantCheck({
  connection,
  checking,
  onCheck,
}: {
  connection: CloudConnection;
  checking: boolean;
  onCheck: () => void;
}) {
  const t = useT(pipelinesText);
  const status = checking ? 'pending' : connection.status;
  const failed = status === 'failed';
  return (
    <section
      aria-label={t('pipelines.clouds.grantTitle')}
      className="flex flex-col gap-2.5 rounded-card border border-line bg-card p-4 shadow-e1"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-14 font-semibold text-tx">{t('pipelines.clouds.grantTitle')}</h2>
        <span role="status" className="flex items-center gap-1.5 text-12 text-tx-2">
          <RunGlyph state={CONNECTION_GLYPH[status]} size={14} />
          {status === 'connected'
            ? t('pipelines.clouds.grantOk')
            : t(`pipelines.clouds.status.${status}`)}
        </span>
        <Button size="xs" variant="ghost" className="ms-auto" loading={checking} onClick={onCheck}>
          {t('pipelines.clouds.checkAgain')}
        </Button>
      </div>
      {connection.principal && (
        <p className="text-12 text-tx-2">
          {t('pipelines.clouds.as', { principal: connection.principal })}
        </p>
      )}
      {failed && connection.problems.length > 0 && (
        <ul
          aria-label={t('pipelines.clouds.grantProblems')}
          className="flex flex-col gap-1 rounded-control bg-amber-50 px-3 py-2 text-12 text-amber-tx"
        >
          {connection.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      {failed && <p className="text-12 text-tx-3">{t('pipelines.clouds.grantFix')}</p>}
    </section>
  );
}
