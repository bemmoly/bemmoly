import { useT } from '@bemmoly/core-web';
import type { RunNextEnvironment } from '@bemmoly/module-pipelines/shared';
import { Button, Card, CardHeader, RunGlyph, Tag, type RunGlyphState } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { pipelineSetupKeys } from '../../api/pipeline-setup.ts';
import { runsText } from '../../i18n/catalog.ts';
import { api } from '../../lib/api.ts';

const GLYPH: Record<RunNextEnvironment['state'], RunGlyphState> = {
  deployed: 'passed',
  deploying: 'running',
  failed: 'failed',
  this_run: 'queued',
  promote: 'queued',
  change_request: 'waiting',
};

/**
 * "Where <version> goes next": each environment on the path, whether the version runs there,
 * this run deploys it, or it gets there by promotion. `onPromote` opens the Deploy or promote
 * dialog for an environment (the run screen passes it in).
 */
export function WhereNext({
  runId,
  live,
  onPromote,
}: {
  runId: string;
  live: boolean;
  onPromote: (environment: string, version: string) => void;
}) {
  const t = useT(runsText);
  const next = useQuery({
    queryKey: pipelineSetupKeys.whereNext(runId),
    queryFn: () => api.pipelineSetup.whereNext(runId),
    refetchInterval: live ? 10_000 : false,
  });
  const data = next.data;
  if (!data || !data.version || data.environments.length === 0) return null;
  const version = data.version;
  const target = data.environments.find(
    (e) => e.state === 'promote' || e.state === 'change_request',
  );
  return (
    <Card>
      <CardHeader
        title={t('pipelinesRuns.next.title', { version })}
        actions={
          target ? (
            <Button
              size="sm"
              variant="primary"
              icon={<Icon name="arrow-up" size={14} />}
              onClick={() => onPromote(target.key, version)}
            >
              {t('pipelinesRuns.next.promote', { environment: target.name })}
            </Button>
          ) : null
        }
      />
      <ul className="m-0 flex list-none flex-col p-0">
        {data.environments.map((environment) => (
          <li
            key={environment.key}
            className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-2.5 text-13"
          >
            <span className="w-32 font-semibold text-tx">{environment.name}</span>
            <RunGlyph state={GLYPH[environment.state]} size={16} />
            <span className="min-w-0 flex-1 text-tx-2">
              {t(`pipelinesRuns.next.state.${environment.state}`)}
              {environment.revision ? (
                <span className="font-mono text-12 text-tx-3"> · {environment.revision}</span>
              ) : null}
            </span>
            {environment.changeRequest ? (
              <Link
                to="/changes/$number"
                params={{ number: String(environment.changeRequest.number) }}
              >
                <Tag size="md" tone="accent">
                  {t('pipelinesRuns.next.change', { number: environment.changeRequest.number })}
                </Tag>
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
