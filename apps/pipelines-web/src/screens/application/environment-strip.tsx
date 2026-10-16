import { useT } from '@bemmoly/core-web';
import type { EnvironmentStripItem } from '@bemmoly/module-pipelines/shared';
import { Skeleton } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { Fragment } from 'react';
import { pipelinesText } from '../../i18n/catalog.ts';
import { formatAge } from '../../lib/format.ts';
import { StateGlyph } from '../../parts/bits.tsx';

const CARD =
  'flex min-w-40 flex-1 basis-0 flex-col gap-1 rounded-card bg-card px-3.5 py-3 text-start shadow-e1 hover:shadow-e1h focus-ring';

/** The words under the version: what is happening in this environment right now. */
function useSubline() {
  const t = useT(pipelinesText);
  return (item: EnvironmentStripItem): string => {
    const sha = item.commitSha?.slice(0, 7) ?? '';
    switch (item.state) {
      case 'canary':
        return t('pipelines.strip.canary', {
          percent: item.trafficPercent,
          previous: item.previousVersion ?? '',
        });
      case 'deploying':
        return t('pipelines.strip.deploying', { version: item.movingVersion ?? '' });
      case 'failed':
        return t('pipelines.strip.failedAt', { version: item.movingVersion ?? item.version ?? '' });
      case 'rolled_back':
        return t('pipelines.strip.rolledBack', { version: item.version ?? '' });
      default:
        if (item.nextWave) return t('pipelines.strip.nextWave', { after: item.nextWave.after });
        if (item.state === 'waiting') return t('pipelines.strip.waiting');
        if (item.healthySince)
          return t('pipelines.strip.healthy', { sha, age: formatAge(item.healthySince) });
        if (item.deployedAt)
          return t('pipelines.strip.deployed', { sha, age: formatAge(item.deployedAt) });
        return sha;
    }
  };
}

/**
 * Dev › Staging › Prod in every region: the version in each and what is moving. One card is
 * selected (?env=), and the block below compares it with the environment before it.
 */
export function EnvironmentStrip({
  items,
  selected,
  onSelect,
}: {
  items: readonly EnvironmentStripItem[];
  selected: string | null;
  onSelect: (key: string) => void;
}) {
  const t = useT(pipelinesText);
  const subline = useSubline();
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <ol aria-label={t('pipelines.strip.label')} className="flex items-stretch gap-2">
        {items.map((item, index) => {
          const before = items[index - 1];
          const arrow = before && before.environment.class !== item.environment.class;
          const isSelected = selected === item.environment.key;
          return (
            <Fragment key={item.environment.key}>
              {arrow ? (
                <li aria-hidden className="flex shrink-0 items-center text-tx-3">
                  <Icon name="chevron" size={14} className="rtl:-scale-x-100" />
                </li>
              ) : null}
              <li className="flex min-w-40 flex-1 basis-0">
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelect(item.environment.key)}
                  className={`${CARD} ${isSelected ? 'ring-1 ring-acc' : ''}`}
                >
                  <span className="flex items-center gap-1 text-12 text-tx-2">
                    <span className="truncate">{item.environment.name}</span>
                    {item.protected ? (
                      <Icon name="shield" size={12} aria-label={t('pipelines.common.protected')} />
                    ) : null}
                  </span>
                  <span className="mt-1 flex items-center gap-2">
                    <StateGlyph state={item.glyph} />
                    <span className="truncate font-mono text-14 text-tx">
                      {item.state === 'canary' || item.state === 'deploying'
                        ? (item.movingVersion ?? item.version)
                        : (item.version ?? t('pipelines.strip.notDeployed'))}
                    </span>
                  </span>
                  <span className="truncate text-12 text-tx-3">{subline(item)}</span>
                </button>
              </li>
            </Fragment>
          );
        })}
      </ol>
    </div>
  );
}

export function EnvironmentStripSkeleton() {
  return (
    <div aria-busy className="flex gap-2 overflow-hidden">
      {[0, 1, 2, 3, 4].map((index) => (
        <div
          key={index}
          className="flex min-w-40 flex-1 flex-col gap-2 rounded-card bg-card px-3.5 py-3 shadow-e1"
        >
          <Skeleton width={70} height={10} />
          <Skeleton width={90} height={14} />
          <Skeleton width={120} height={10} />
        </div>
      ))}
    </div>
  );
}
