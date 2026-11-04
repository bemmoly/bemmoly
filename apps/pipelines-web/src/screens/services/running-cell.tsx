import { useT } from '@bemmoly/core-web';
import type {
  CurrentState,
  ServiceChangeRef,
  ServiceRunning,
} from '@bemmoly/module-pipelines/shared';
import { Badge } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { Link } from '@tanstack/react-router';
import { servicesText } from '../../i18n/catalog.ts';
import { currentGlyph, StateGlyph } from '../../parts/bits.tsx';

/** Moving states show the version on its way in, the rest the version that runs. */
export function shownVersion(running: ServiceRunning): string | null {
  return running.state === 'deploying' || running.state === 'canary'
    ? (running.movingVersion ?? running.version)
    : running.version;
}

/** Healthy, deploying, failing: the word a state reads as on Services. */
export const HEALTH_WORD = {
  idle: 'pipelinesServices.health.healthy',
  deploying: 'pipelinesServices.health.deploying',
  canary: 'pipelinesServices.health.deploying',
  waiting: 'pipelinesServices.health.waiting',
  failed: 'pipelinesServices.health.failing',
  rolled_back: 'pipelinesServices.health.rolledBack',
} as const satisfies Record<CurrentState, string>;

/** "CHG-1042 · 1 of 2 approvals", linking to the change request. */
export function ChangeChip({ change }: { change: ServiceChangeRef }) {
  const t = useT(servicesText);
  const waiting = change.status === 'waiting';
  return (
    <Link
      to="/changes/$number"
      params={{ number: change.number }}
      className="inline-flex rounded-chip focus-ring"
    >
      <Badge tone={waiting ? 'warn' : 'neutral'} className="inline-flex items-center gap-1">
        <Icon name={waiting ? 'clock' : 'checklist'} size={12} />
        {waiting
          ? t('pipelinesServices.change.waiting', {
              number: change.number,
              approvals: change.approvals,
              needed: change.needed,
            })
          : change.number}
      </Badge>
    </Link>
  );
}

/** One environment's cell: the state, the version and its commit, or "Not deployed". */
export function RunningCell({ running }: { running: ServiceRunning | undefined }) {
  const t = useT(servicesText);
  if (!running?.version && !running?.movingVersion)
    return <span className="text-12 text-tx-3">{t('pipelinesServices.notDeployed')}</span>;
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-1.5">
      <StateGlyph state={currentGlyph(running.state)} size={12} />
      <span className="font-mono text-13 text-tx">{shownVersion(running)}</span>
      {running.commitSha ? (
        <span className="font-mono text-11 text-tx-3">{running.commitSha.slice(0, 7)}</span>
      ) : null}
      {running.pending ? <ChangeChip change={running.pending} /> : null}
    </span>
  );
}
