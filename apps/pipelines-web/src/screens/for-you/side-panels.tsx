import { formatDate, useT } from '@bemmoly/core-web';
import type { ForYou, WaitingApproval } from '@bemmoly/module-pipelines/shared';
import { Badge, Button, EmptyState } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { Link, useRouter } from '@tanstack/react-router';
import { pipelinesText } from '../../i18n/catalog.ts';
import { BASE_PATH } from '../../lib/sign-in.ts';
import { formatAge } from '../../lib/format.ts';
import { StateGlyph, TeamMark } from '../../parts/bits.tsx';

const CARD = 'flex flex-col gap-1 rounded-card border border-line bg-card px-4 py-3 shadow-e1';

/** Where Review goes: the release's Promote screen, or the releases inbox for a train. */
export function reviewPath(item: WaitingApproval): string {
  if (item.releaseId) {
    const promotion = item.promotionId ? `&promotion=${item.promotionId}` : '';
    return `${BASE_PATH}/releases/${item.releaseId}/promote?to=${item.environment.class}${promotion}`;
  }
  return `${BASE_PATH}/releases`;
}

export function WaitingPanel({ items }: { items: ForYou['waitingForMe'] }) {
  const t = useT(pipelinesText);
  const router = useRouter();
  return (
    <section className={CARD} aria-labelledby="waiting-heading">
      <div className="flex items-center gap-2">
        <h2 id="waiting-heading" className="text-16 leading-title font-semibold text-tx">
          {t('pipelines.forYou.waitingTitle')}
        </h2>
        {items.length ? <Badge tone="warn">{items.length}</Badge> : null}
      </div>
      {items.length === 0 ? (
        <EmptyState
          size="sm"
          icon={<Icon name="shield" size={16} />}
          title={t('pipelines.forYou.waitingEmpty')}
        />
      ) : (
        <ul className="flex flex-col">
          {items.map((item, index) => (
            <li
              key={item.promotionId ?? item.departureId ?? index}
              className="flex items-center gap-3 border-b border-line-2 py-2.5 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-tx">
                  {item.title}{' '}
                  <span className="font-mono font-normal text-tx-2">{item.version}</span>
                </p>
                <p className="truncate text-12 text-tx-3">
                  {[
                    t('pipelines.forYou.toEnvironment', { env: item.environment.name }),
                    item.requester?.name,
                    item.gatesSummary,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <Button
                size="sm"
                variant={index === 0 ? 'primary' : 'secondary'}
                onClick={() => router.history.push(reviewPath(item))}
              >
                {t('pipelines.forYou.review')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function TeamsPanel({ teams }: { teams: ForYou['myTeams'] }) {
  const t = useT(pipelinesText);
  if (teams.length === 0) return null;
  return (
    <section className={CARD} aria-labelledby="teams-heading">
      <h2 id="teams-heading" className="mb-1 text-16 leading-title font-semibold text-tx">
        {t('pipelines.forYou.teamsTitle')}
      </h2>
      <ul className="flex flex-col gap-1">
        {teams.map((team) => {
          const broken = team.mainState === 'broken';
          const culprit = team.culprit;
          return (
            <li key={team.team.id} className="flex flex-col gap-0.5 py-1">
              <div className="flex items-center gap-2">
                <TeamMark name={team.team.name} />
                <span className="min-w-0 flex-1 truncate font-medium text-tx">
                  {team.team.name}
                </span>
                <StateGlyph state={broken ? 'failed' : 'passed'} />
                <span className={`text-12 ${broken ? 'text-red-tx' : 'text-tx-3'}`}>
                  {broken && team.since
                    ? t('pipelines.forYou.mainBrokenFor', { age: formatAge(team.since) })
                    : t(broken ? 'pipelines.forYou.mainBroken' : 'pipelines.forYou.mainHealthy')}
                </span>
              </div>
              {broken && culprit ? (
                <Link
                  to="/runs/$id"
                  params={{ id: culprit.runId }}
                  className="truncate ps-6.5 text-12 text-tx-3 hover:text-acc"
                >
                  {[
                    t('pipelines.forYou.culprit', {
                      sha: culprit.commitSha.slice(0, 7),
                      who: culprit.author?.name ?? culprit.authorLogin ?? '',
                    }),
                    culprit.application?.name,
                    culprit.failingJob,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function OnCallPanel({ onCall }: { onCall: ForYou['onCall'] }) {
  const t = useT(pipelinesText);
  const router = useRouter();
  if (!onCall) return null;
  return (
    <section className={CARD} aria-labelledby="oncall-heading">
      <div className="flex items-center gap-2">
        <h2 id="oncall-heading" className="text-16 leading-title font-semibold text-tx">
          {t('pipelines.forYou.onCallTitle')}
        </h2>
        <Badge tone="accent">
          {t('pipelines.forYou.onCallUntil', {
            time: formatDate(onCall.until, { hour: '2-digit', minute: '2-digit' }),
          })}
        </Badge>
      </div>
      <p className="text-12 text-tx-2">
        {onCall.label}. {onCall.summary}
      </p>
      <Button
        size="sm"
        className="mt-1.5 self-start"
        onClick={() => router.history.push(`${BASE_PATH}/releases/changes`)}
      >
        {t('pipelines.forYou.whatChanged')}
      </Button>
    </section>
  );
}
