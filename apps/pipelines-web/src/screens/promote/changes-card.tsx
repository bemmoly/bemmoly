import { useT } from '@bemmoly/core-web';
import type { ReleaseCompare } from '@bemmoly/module-pipelines/shared';
import { Button, RunGlyph, Skeleton } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { useCompare, useRelease } from '../../hooks/use-shipping.ts';
import { pipelinesText } from '../../i18n/catalog.ts';
import { LoadFailed } from '../../parts/load-failed.tsx';
import { Panel } from '../../parts/screen.tsx';
import type { PromoteView } from './use-promote.ts';

const SHOWN = 4;

function Commits({ compare }: { compare: ReleaseCompare }) {
  const t = useT(pipelinesText);
  const [all, setAll] = useState(false);
  const withIssue = compare.commits.filter((commit) => commit.issueKey);
  const listed = all ? compare.commits : withIssue.slice(0, SHOWN);
  const rest = compare.commits.length - listed.length;
  return (
    <ul className="flex flex-col">
      {listed.map((commit) => (
        <li
          key={commit.sha}
          className="flex items-center gap-2.5 border-b border-line-2 py-1.75 text-13"
        >
          <span className="w-18 shrink-0 truncate font-mono text-12 text-tx-2">
            {commit.issueKey ?? commit.sha.slice(0, 7)}
          </span>
          <span className="min-w-0 flex-1 truncate text-tx">{commit.message}</span>
        </li>
      ))}
      {rest > 0 && (
        <li className="border-b border-line-2">
          <button
            type="button"
            onClick={() => setAll(true)}
            className="flex w-full items-center gap-2 py-1.75 text-start text-13 text-tx-2 hover:text-tx"
          >
            <span className="flex-1">
              {withIssue.length === listed.length
                ? t('pipelines.promote.moreWithoutIssues', { count: rest })
                : t('pipelines.promote.moreCommits', { count: rest })}
            </span>
            <Icon name="chevron" size={14} />
          </button>
        </li>
      )}
    </ul>
  );
}

function CloserLook({ compare }: { compare: ReleaseCompare }) {
  const t = useT(pipelinesText);
  if (compare.migrations.length === 0 && compare.config.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <h3 className="mt-3.5 text-11 font-semibold text-tx-2">
        {t('pipelines.promote.closerLook')}
      </h3>
      {compare.migrations.map((migration) => (
        <p key={migration.description} className="flex items-start gap-2 py-0.5 text-12 text-tx">
          <Icon name="database" size={14} className="mt-0.5 shrink-0 text-tx-3" />
          <span className="flex-1">
            {t(
              migration.reversible
                ? 'pipelines.promote.migrationReversible'
                : 'pipelines.promote.migrationOneWay',
              { what: migration.description },
            )}
          </span>
          {migration.reviewed ? (
            <span className="rounded-chip bg-green-50 px-1.5 py-px text-11 font-semibold text-green-tx">
              {t('pipelines.promote.reviewed')}
            </span>
          ) : (
            <span className="rounded-chip bg-amber-50 px-1.5 py-px text-11 font-semibold text-amber-tx">
              {t('pipelines.promote.notReviewed')}
            </span>
          )}
        </p>
      ))}
      {compare.config.map((change) => (
        <p key={change.name} className="flex items-start gap-2 py-0.5 text-12 text-tx">
          <Icon name="gear" size={14} className="mt-0.5 shrink-0 text-tx-3" />
          <span className="min-w-0 flex-1 break-words">
            {change.secret
              ? t('pipelines.promote.secretChanged', { name: change.name })
              : t('pipelines.promote.configChanged', {
                  name: change.name,
                  from: change.from ?? t('pipelines.promote.unset'),
                  to: change.to ?? t('pipelines.promote.unset'),
                })}
          </span>
        </p>
      ))}
    </div>
  );
}

/**
 * What's changing: the commits between what runs there now and this release (issues first),
 * the migrations and configuration that deserve a closer look, and where the same release
 * already runs and how long it has been healthy.
 */
export function ChangesCard({ view }: { view: PromoteView }) {
  const t = useT(pipelinesText);
  const compare = useCompare(
    view.previous ? { from: view.previous.id, to: view.release.id } : null,
  );
  const release = useRelease(view.release.id);
  const elsewhere = release.data?.environments ?? [];
  return (
    <Panel
      title={t('pipelines.promote.changing')}
      meta={
        view.previous
          ? compare.data
            ? t('pipelines.promote.changingMeta', {
                from: view.previous.version,
                to: view.release.version,
                commits: compare.data.counts.commits,
                authors: compare.data.counts.authors,
              })
            : t('pipelines.promote.fromTo', {
                from: view.previous.version,
                to: view.release.version,
              })
          : t('pipelines.promote.firstDeploy')
      }
    >
      {!view.previous ? null : compare.isError ? (
        <LoadFailed bare size="sm" error={compare.error} onRetry={() => void compare.refetch()} />
      ) : !compare.data ? (
        <div aria-busy className="flex flex-col gap-3 py-2">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} width={`${85 - index * 12}%`} />
          ))}
        </div>
      ) : (
        <>
          <Commits compare={compare.data} />
          <CloserLook compare={compare.data} />
          {compare.data.compareUrl && (
            <Button
              size="xs"
              variant="ghost"
              className="mt-2 self-start"
              onClick={() => window.open(compare.data.compareUrl ?? '', '_blank', 'noopener')}
            >
              <Icon name="external" size={14} />
              {t('pipelines.promote.openCompare')}
            </Button>
          )}
        </>
      )}
      {elsewhere.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="mt-3.5 text-11 font-semibold text-tx-2">
            {t('pipelines.promote.elsewhere')}
          </h3>
          {elsewhere.map((environment) => (
            <p key={environment.id} className="flex items-center gap-2 text-12 text-tx">
              <RunGlyph state="passed" size={14} />
              {environment.name}
            </p>
          ))}
        </div>
      )}
    </Panel>
  );
}
