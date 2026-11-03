import { useT } from '@bemmoly/core-web';
import type { ChangeRequestDetail } from '@bemmoly/module-pipelines/shared';
import { Avatar, Card, CardHeader, RelativeTime, RunGlyph } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { Link } from '@tanstack/react-router';
import { useCompare } from '../../hooks/use-shipping.ts';
import { changeRequestsText } from '../../i18n/catalog.ts';

/* The cards of a change request's left column: why, what changes, commits, evidence, rollback. */

export function WhyCard({ request }: { request: ChangeRequestDetail }) {
  const t = useT(changeRequestsText);
  return (
    <Card>
      <CardHeader title={t('pipelinesChangeRequests.detail.why')} />
      <p className="p-4 text-13 whitespace-pre-wrap text-tx">{request.why}</p>
    </Card>
  );
}

export function ChangesCard({ request }: { request: ChangeRequestDetail }) {
  const t = useT(changeRequestsText);
  const tested = new Map(request.evidence.tests.map((test) => [test.application, test]));
  return (
    <Card>
      <CardHeader
        title={t('pipelinesChangeRequests.detail.whatChanges', { name: request.environment.name })}
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-120 text-13">
          <thead className="text-start text-12 text-tx-3">
            <tr className="border-b border-line">
              <th className="px-4 py-2 text-start font-medium">
                {t('pipelinesChangeRequests.detail.service')}
              </th>
              <th className="px-4 py-2 text-start font-medium">
                {t('pipelinesChangeRequests.detail.now')}
              </th>
              <th className="px-4 py-2 text-start font-medium">
                {t('pipelinesChangeRequests.detail.after')}
              </th>
              <th className="px-4 py-2 text-start font-medium">
                {t('pipelinesChangeRequests.detail.commits')}
              </th>
              <th className="px-4 py-2 text-start font-medium">
                {t('pipelinesChangeRequests.detail.tests')}
              </th>
            </tr>
          </thead>
          <tbody>
            {request.items.map((item) => {
              const test = tested.get(item.application.key);
              const state = !test ? 'skipped' : test.failed > 0 ? 'failed' : 'passed';
              return (
                <tr key={item.application.key} className="border-b border-line-2 last:border-0">
                  <td className="px-4 py-2 font-mono">{item.application.key}</td>
                  <td className="px-4 py-2 font-mono text-tx-3">
                    {item.fromVersion ?? t('pipelinesChangeRequests.common.nothing')}
                  </td>
                  <td className="px-4 py-2 font-mono font-semibold">{item.toVersion}</td>
                  <td className="px-4 py-2 tabular-nums">{item.commitCount}</td>
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center gap-1.5 text-12 text-tx-2">
                      <RunGlyph
                        state={state}
                        size={14}
                        label={t(`pipelinesChangeRequests.tests.${state}`)}
                      />
                      {test
                        ? t('pipelinesChangeRequests.detail.testCounts', {
                            passed: test.passed,
                            failed: test.failed,
                          })
                        : t('pipelinesChangeRequests.tests.skipped')}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** The commits in the first service's new version, since what runs there now. */
export function CommitsCard({ request }: { request: ChangeRequestDetail }) {
  const t = useT(changeRequestsText);
  const first = request.items[0];
  const compare = useCompare(
    first?.fromReleaseId ? { from: first.fromReleaseId, to: first.releaseId } : null,
  );
  const commits = compare.data?.commits ?? [];
  if (!first || !first.fromReleaseId || commits.length === 0) return null;
  return (
    <Card>
      <CardHeader
        title={t('pipelinesChangeRequests.detail.commitsIn', {
          application: first.application.key,
          version: first.toVersion,
        })}
        hint={t('pipelinesChangeRequests.detail.since', { version: first.fromVersion ?? '' })}
      />
      <ul className="flex flex-col">
        {commits.slice(0, 20).map((commit) => (
          <li
            key={commit.sha}
            className="flex items-center gap-3 border-b border-line-2 px-4 py-2 text-13 last:border-0"
          >
            <span className="w-18 shrink-0 font-mono text-12 text-tx-3">
              {commit.sha.slice(0, 7)}
            </span>
            <span className="min-w-0 flex-1 truncate">{commit.message}</span>
            <span className="hidden shrink-0 text-12 text-tx-3 md:inline">
              {commit.author?.name ?? commit.authorLogin ?? ''}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function EvidenceCard({ request }: { request: ChangeRequestDetail }) {
  const t = useT(changeRequestsText);
  const { runs, tests, scans } = request.evidence;
  const empty = runs.length + tests.length + scans.length === 0;
  return (
    <Card>
      <CardHeader title={t('pipelinesChangeRequests.detail.evidence')} />
      <ul className="flex flex-col gap-3 p-4 text-13">
        {empty ? (
          <li className="text-tx-3">{t('pipelinesChangeRequests.detail.noEvidence')}</li>
        ) : null}
        {runs.map((run) => (
          <li key={run.id} className="flex items-start gap-2.5">
            <RunGlyph
              state={
                run.state === 'passed' ? 'passed' : run.state === 'failed' ? 'failed' : 'running'
              }
              size={14}
              label={run.state}
            />
            <span className="flex flex-col">
              <Link
                to="/runs/$id"
                params={{ id: run.id }}
                className="font-semibold text-acc hover:underline"
              >
                {t('pipelinesChangeRequests.detail.run', { number: run.number })}
              </Link>
              <span className="text-12 text-tx-3">
                {t('pipelinesChangeRequests.detail.builtVersion', { application: run.application })}
              </span>
            </span>
          </li>
        ))}
        {tests.map((test) => (
          <li key={`tests-${test.application}`} className="flex items-start gap-2.5">
            <RunGlyph
              state={test.failed > 0 ? 'failed' : 'passed'}
              size={14}
              label={t('pipelinesChangeRequests.detail.tests')}
            />
            <span className="flex flex-col">
              <b className="font-semibold">
                {t('pipelinesChangeRequests.detail.testsOf', { application: test.application })}
              </b>
              <span className="text-12 text-tx-3">
                {t('pipelinesChangeRequests.detail.testCounts', {
                  passed: test.passed,
                  failed: test.failed,
                })}
              </span>
            </span>
          </li>
        ))}
        {scans.map((scan, index) => (
          <li key={`scan-${scan.application}-${index}`} className="flex items-start gap-2.5">
            <RunGlyph
              state={
                scan.state === 'passed' ? 'passed' : scan.state === 'failed' ? 'failed' : 'queued'
              }
              size={14}
              label={scan.state}
            />
            <span className="flex flex-col">
              <b className="font-semibold">
                {t('pipelinesChangeRequests.detail.scanOf', { application: scan.application })}
              </b>
              <span className="text-12 text-tx-3">
                {t(
                  `pipelinesChangeRequests.scan.${scan.state === 'passed' ? 'passed' : scan.state === 'failed' ? 'failed' : 'other'}`,
                )}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function RollbackCard({ request }: { request: ChangeRequestDetail }) {
  const t = useT(changeRequestsText);
  const previous = request.items.filter((item) => item.fromVersion);
  return (
    <Card>
      <CardHeader title={t('pipelinesChangeRequests.detail.ifWrong')} />
      <div className="flex flex-col gap-2.5 p-4 text-13">
        {request.rollback ? <p className="whitespace-pre-wrap">{request.rollback}</p> : null}
        {previous.length ? (
          <p className="flex items-start gap-2 text-tx-2">
            <Icon name="undo" size={14} className="mt-0.5 shrink-0 text-tx-3" />
            {t('pipelinesChangeRequests.detail.rollbackReady', {
              versions: previous
                .map((item) => `${item.application.key} ${item.fromVersion}`)
                .join(', '),
            })}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

export function ActivityCard({ request }: { request: ChangeRequestDetail }) {
  const t = useT(changeRequestsText);
  return (
    <Card>
      <CardHeader title={t('pipelinesChangeRequests.detail.activity')} />
      <ol className="flex flex-col gap-3 p-4 text-12">
        {request.activity.map((entry, index) => (
          <li key={`${entry.at}-${index}`} className="flex items-start gap-2">
            {entry.by ? (
              <Avatar name={entry.by.name} size={20} />
            ) : (
              <Icon name="rocket" size={14} className="mt-0.5 text-tx-3" />
            )}
            <span className="min-w-0 flex-1 text-tx-2">
              {entry.by ? <b className="font-semibold text-tx">{entry.by.name} </b> : null}
              {entry.text} <RelativeTime iso={entry.at} className="text-tx-3" />
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
