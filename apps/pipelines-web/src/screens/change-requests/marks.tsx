import { useT } from '@bemmoly/core-web';
import type { ChangeRequestStatus, ChangeRisk } from '@bemmoly/module-pipelines/shared';
import { Badge, type BadgeTone } from '@bemmoly/ui';
import { Icon, type IconName } from '@bemmoly/ui/icons';
import { changeRequestsText } from '../../i18n/catalog.ts';

/*
 * The marks every change request screen draws the same way: its status ("1 of 2 approvals"),
 * its risk, and the versions it moves.
 */

const STATUS: Record<ChangeRequestStatus, { tone: BadgeTone; icon: IconName }> = {
  draft: { tone: 'neutral', icon: 'edit' },
  waiting: { tone: 'warn', icon: 'clock' },
  changes_requested: { tone: 'warn', icon: 'edit' },
  approved: { tone: 'accent', icon: 'rocket' },
  deploying: { tone: 'accent', icon: 'rocket' },
  deployed: { tone: 'ok', icon: 'check' },
  failed: { tone: 'danger', icon: 'warning' },
  rejected: { tone: 'danger', icon: 'close' },
  withdrawn: { tone: 'outline', icon: 'undo' },
};

export function StatusChip({
  status,
  got,
  needed,
}: {
  status: ChangeRequestStatus;
  got?: number;
  needed?: number;
}) {
  const t = useT(changeRequestsText);
  const { tone, icon } = STATUS[status];
  return (
    <Badge tone={tone} className="inline-flex items-center gap-1 whitespace-nowrap">
      <Icon name={icon} size={12} />
      {status === 'waiting' && needed
        ? t('pipelinesChangeRequests.status.waitingCount', { got: got ?? 0, needed })
        : t(`pipelinesChangeRequests.status.${status}`)}
    </Badge>
  );
}

const RISK: Record<ChangeRisk, BadgeTone> = { low: 'outline', medium: 'neutral', high: 'warn' };

export function RiskMark({ risk }: { risk: ChangeRisk }) {
  const t = useT(changeRequestsText);
  return (
    <Badge tone={RISK[risk]} className="whitespace-nowrap">
      {t(`pipelinesChangeRequests.risk.${risk}`)}
    </Badge>
  );
}

/** "CHG-1042", in the mono face, as people read it aloud. */
export function ChangeNumber({ number }: { number: string }) {
  return <span className="font-mono text-12 font-semibold text-tx-2">{number}</span>;
}

/** One service moving: buyer-agent 1.7.2 to 1.8.0. */
export function VersionMove({
  application,
  from,
  to,
}: {
  application: string;
  from: string | null;
  to: string;
}) {
  const t = useT(changeRequestsText);
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-13">
      <span className="font-mono font-semibold text-tx">{application}</span>
      <span className="font-mono text-tx-3">
        {from ?? t('pipelinesChangeRequests.common.nothing')}
      </span>
      <Icon name="arrow" size={12} className="text-tx-3" />
      <span className="font-mono text-tx">{to}</span>
    </span>
  );
}
