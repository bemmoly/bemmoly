import { useFormatLocale, useT } from '@bemmoly/core-web';
import type { Gate, GateResult } from '@bemmoly/module-pipelines/shared';
import { Avatar, AvatarStack, GateList, type GateItem } from '@bemmoly/ui';
import { pipelinesText } from '../../i18n/catalog.ts';
import { Panel } from '../../parts/screen.tsx';
import type { PromoteView } from './use-promote.ts';

/** The order a person reads the evidence in: the build, then the world, then people. */
const ORDER: readonly Gate[] = [
  'tests',
  'security_scan',
  'external_checks',
  'migration_reviewed',
  'dependencies',
  'staging_healthy',
  'canary',
  'error_budget',
  'freeze',
  'window',
  'webhook',
  'custom',
  'approvals',
];

const STATE_WORDS = {
  pass: 'pipelines.gate.pass',
  fail: 'pipelines.gate.fail',
  pending: 'pipelines.gate.pending',
} as const;

/** Who has approved so far, and what is still needed from whom. */
function Approvers({ view }: { view: PromoteView }) {
  const t = useT(pipelinesText);
  return (
    <div className="mt-1 flex flex-col gap-1.5">
      {view.approvals.map((approval) => (
        <span key={approval.id} className="flex items-center gap-1.5 text-12 text-tx">
          <Avatar name={approval.user.name} size={18} />
          {approval.decision === 'approved'
            ? t('pipelines.promote.approvedBy', { name: approval.user.name })
            : t('pipelines.promote.rejectedBy', { name: approval.user.name })}
          {approval.comment && <span className="truncate text-tx-3">{approval.comment}</span>}
        </span>
      ))}
      {view.requirements
        .filter((requirement) => requirement.have < requirement.needed)
        .map((requirement) => (
          <span
            key={requirement.requirement}
            className="flex flex-wrap items-center gap-1.5 text-12 text-tx-3"
          >
            {requirement.candidates.length > 0 && (
              <AvatarStack
                people={requirement.candidates}
                size={18}
                max={3}
                label={requirement.label}
              />
            )}
            <span>{requirement.label}</span>
            {requirement.canApprove && (
              <span className="font-medium text-acc">{t('pipelines.promote.youCanApprove')}</span>
            )}
          </span>
        ))}
    </div>
  );
}

/**
 * Every gate the policies ask for, each with its state and reason; approvals list who has
 * approved and who still must. A fact not known yet waits, never passes.
 */
export function GatesCard({ view }: { view: PromoteView }) {
  const t = useT(pipelinesText);
  const locale = useFormatLocale();
  const needed = view.requirements.reduce((sum, requirement) => sum + requirement.needed, 0);
  const have = view.requirements.reduce(
    (sum, requirement) => sum + Math.min(requirement.have, requirement.needed),
    0,
  );
  const approvalsGate: GateResult | undefined = view.gates.find(
    (gate) => gate.gate === 'approvals',
  );
  const items: GateItem[] = [...view.gates]
    .sort((a, b) => ORDER.indexOf(a.gate) - ORDER.indexOf(b.gate))
    .filter((gate) => gate.gate !== 'approvals')
    .map((gate) => ({
      key: gate.gate === 'custom' ? `${gate.gate}:${gate.label}` : gate.gate,
      state: gate.state,
      label: gate.label,
      reason: gate.reason,
    }));
  if (needed > 0) {
    items.push({
      key: 'approvals',
      state: approvalsGate?.state ?? (have >= needed ? 'pass' : 'pending'),
      label: t('pipelines.promote.approvalsCount', { have, needed }),
      children: <Approvers view={view} />,
    });
  }
  const policies = new Intl.ListFormat(locale, { type: 'conjunction' }).format(
    view.policies.map((policy) => policy.name),
  );
  return (
    <Panel
      title={t('pipelines.promote.gates')}
      meta={policies ? t('pipelines.promote.gatesFrom', { policies }) : undefined}
    >
      {items.length ? (
        <GateList
          gates={items}
          ariaLabel={t('pipelines.promote.gates')}
          stateLabel={(state) => t(STATE_WORDS[state])}
        />
      ) : (
        <p className="py-2 text-13 text-tx-3">{t('pipelines.promote.noGates')}</p>
      )}
    </Panel>
  );
}
