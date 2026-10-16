import { useT } from '@bemmoly/core-web';
import type { FailedTest, RunDetail } from '@bemmoly/module-pipelines/shared';
import { Avatar, Badge, Button, Kbd, KeyChip } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { pipelinesText } from '../../i18n/catalog.ts';

const CARD = 'flex flex-col gap-2 rounded-card border border-line bg-card px-3.5 py-3 shadow-e1';

function Failure({ test, onOpen }: { test: FailedTest; onOpen: () => void }) {
  const t = useT(pipelinesText);
  const file = test.file.split('/').at(-1) ?? test.file;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full flex-col items-start gap-0.5 rounded-control px-1 py-1 text-start hover:bg-hover focus-ring"
      >
        <span className="font-mono text-12 font-medium text-tx">
          {test.line ? t('pipelines.run.fileLine', { file, line: test.line }) : file}
        </span>
        <span className="text-12 text-tx-2">{test.name}</span>
        {test.quarantined ? (
          <Badge className="mt-0.5">{t('pipelines.run.quarantined')}</Badge>
        ) : null}
      </button>
    </li>
  );
}

/**
 * What failed, by test name and line, with Re-run failed at hand (Shift+R). A test that
 * often fails on main is flagged: that suggests flaky rather than broken by this change.
 * Failures show while the run is still going; Re-run failed waits until it has finished,
 * because the server refuses to re-run a run that is still going.
 */
export function FailuresCard({
  run,
  onRerunFailed,
  rerunning,
  onOpenJob,
}: {
  run: RunDetail;
  onRerunFailed: () => void;
  rerunning: boolean;
  onOpenJob: (jobId: string) => void;
}) {
  const t = useT(pipelinesText);
  const failures = run.tests?.failures ?? [];
  const failedJobs = run.jobs.filter((job) => job.state === 'failed');
  if (run.state !== 'failed' && failures.length === 0) return null;
  const flaky = failures.find(
    (test) => test.flakiness && test.flakiness.failedRecent > 0,
  )?.flakiness;
  return (
    <section className={CARD} aria-labelledby="failures-heading">
      <div className="flex items-center gap-2">
        <h2 id="failures-heading" className="text-16 leading-title font-semibold text-tx">
          {failures.length
            ? t('pipelines.run.testsFailed', { count: run.tests?.failed ?? failures.length })
            : t('pipelines.run.jobsFailed', { count: failedJobs.length })}
        </h2>
        {run.state === 'failed' ? (
          <Button
            size="sm"
            variant="primary"
            className="ms-auto"
            onClick={onRerunFailed}
            loading={rerunning}
          >
            <Icon name="undo" size={14} />
            {t('pipelines.run.rerunFailed')}
            <Kbd keys="Shift+R" variant="plain" className="ms-1 max-md:hidden" />
          </Button>
        ) : null}
      </div>
      {failures.length ? (
        <ul className="flex flex-col">
          {failures.slice(0, 8).map((test) => (
            <Failure
              key={`${test.file}:${test.name}`}
              test={test}
              onOpen={() => onOpenJob(test.jobId)}
            />
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-1 text-12">
          {failedJobs.map((job) => (
            <li key={job.id}>
              <button
                type="button"
                onClick={() => onOpenJob(job.id)}
                className="flex flex-col items-start rounded-control px-1 py-1 text-start hover:bg-hover focus-ring"
              >
                <span className="font-medium text-tx">{job.name}</span>
                {job.failureSummary ? (
                  <span className="text-tx-2">{job.failureSummary}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
      {failures.length > 8 ? (
        <p className="text-12 text-tx-3">
          {t('pipelines.run.moreFailures', { count: failures.length - 8 })}
        </p>
      ) : null}
      {flaky ? (
        <Badge tone="warn" className="self-start">
          {t('pipelines.run.flaky', { failed: flaky.failedRecent, of: flaky.ofRecent })}
        </Badge>
      ) : null}
    </section>
  );
}

/** The change this run is for: the pull request or branch, who wrote it, the commit. */
export function ChangeCard({ run }: { run: RunDetail }) {
  const t = useT(pipelinesText);
  const author = run.author?.name ?? run.authorLogin;
  const commitUrl = run.repository?.url ? `${run.repository.url}/commit/${run.commitSha}` : null;
  return (
    <section className={CARD} aria-labelledby="change-heading">
      <h2 id="change-heading" className="text-12 text-tx-3">
        {run.pullRequest ? t('pipelines.run.pullRequestHeading') : t('pipelines.run.commitHeading')}
      </h2>
      <p className="flex items-start gap-2 font-medium text-tx">
        <Icon
          name={run.pullRequest ? 'pull-request' : 'commit'}
          size={14}
          className="mt-0.5 shrink-0"
        />
        <span>
          {run.pullRequest ? t('pipelines.run.pullRequest', { number: run.pullRequest }) : run.ref}{' '}
          {run.title}
        </span>
      </p>
      <p className="flex flex-wrap items-center gap-2 text-12 text-tx-2">
        {author ? (
          <>
            <Avatar name={author} size={18} />
            {author}
          </>
        ) : null}
        {run.issueKey ? <KeyChip issueKey={run.issueKey} /> : null}
        {commitUrl ? (
          <a href={commitUrl} target="_blank" rel="noreferrer" className="font-mono">
            {run.commitSha.slice(0, 7)}
          </a>
        ) : (
          <span className="font-mono">{run.commitSha.slice(0, 7)}</span>
        )}
      </p>
      {run.repository ? (
        <p className="truncate font-mono text-12 text-tx-3">{run.repository.fullName}</p>
      ) : null}
    </section>
  );
}
