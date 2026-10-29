import { useT } from '@bemmoly/core-web';
import type { Journey as JourneyData } from '@bemmoly/module-pipelines/shared';
import { Badge, Button, Journey, KeyChip, Skeleton } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { pipelinesText } from '../../i18n/catalog.ts';
import { StateGlyph } from '../../parts/bits.tsx';

/**
 * One change as a journey from commit to the last Prod region, with what is happening now
 * and the one action that moves it on: re-run what failed, or open it. A change waiting on its
 * approvers opens too: there is no reminder to send them yet.
 */
export function JourneyCard({
  journey,
  selected,
  onOpen,
  onRerun,
  rerunning,
}: {
  journey: JourneyData;
  selected: boolean;
  onOpen: () => void;
  onRerun: () => void;
  rerunning: boolean;
}) {
  const t = useT(pipelinesText);
  const { note } = journey;
  const failed = note.glyph === 'failed';
  return (
    <article
      data-journey
      tabIndex={-1}
      aria-label={journey.title}
      aria-current={selected ? 'true' : undefined}
      className={`flex flex-col gap-3 rounded-card border bg-card px-4 py-3.5 shadow-e1 outline-0 ${
        selected ? 'border-acc' : 'border-line'
      }`}
    >
      <header className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 truncate rounded-chip text-start font-medium text-tx hover:text-acc focus-ring"
        >
          {journey.title}
        </button>
        {journey.issueKey ? <KeyChip issueKey={journey.issueKey} /> : null}
        <span className="ms-auto flex min-w-0 items-center gap-1.5 text-12 text-tx-3">
          <Icon name="branch" size={14} />
          <span className="truncate">{journey.repository ?? journey.application?.name}</span>
          <span className="font-mono">{journey.commitSha.slice(0, 7)}</span>
        </span>
      </header>
      <Journey
        stations={journey.stations.map((station) => ({
          key: station.key,
          label: station.label,
          state: station.state,
          ...(station.detail ? { detail: station.detail } : {}),
          live: station.live,
        }))}
        progress={journey.progress}
        ariaLabel={t('pipelines.forYou.journeyLabel', { title: journey.title })}
        stateLabel={(state) => t(`pipelines.state.${state}`)}
      />
      <footer className="flex flex-wrap items-center gap-2 border-t border-line-2 pt-2.5 text-12">
        <StateGlyph state={note.glyph} />
        <span className={`min-w-0 flex-1 ${failed ? 'text-red-tx' : 'text-tx-2'}`}>
          {note.text}
        </span>
        {note.flag ? <Badge tone="warn">{note.flag}</Badge> : null}
        {note.action === 'rerun_failed' && journey.runId ? (
          <Button size="sm" onClick={onRerun} loading={rerunning}>
            <Icon name="undo" size={14} />
            {t('pipelines.run.rerunFailed')}
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={onOpen}>
            {t('pipelines.forYou.open')}
          </Button>
        )}
      </footer>
    </article>
  );
}

export function JourneySkeleton() {
  return (
    <div
      aria-busy
      className="flex flex-col gap-3 rounded-card border border-line bg-card px-4 py-3.5 shadow-e1"
    >
      <Skeleton width="45%" height={13} />
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }, (_, index) => (
          <div key={index} className="flex flex-col items-center gap-1.5">
            <Skeleton width={16} height={16} />
            <Skeleton width={36} height={9} />
          </div>
        ))}
      </div>
      <Skeleton width="70%" height={10} />
    </div>
  );
}
