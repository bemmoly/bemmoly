import { useT } from '@bemmoly/core-web';
import type { ApprovalCondition, EnvironmentV2View } from '@bemmoly/module-pipelines/shared';
import { Badge, Button, Card, CardBody, CardHeader, Select, Switch } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { useEnvironmentV2Writes } from '../../../hooks/use-environments-v2.ts';
import { environmentsText } from '../../../i18n/catalog.ts';
import { ActionError } from '../../../parts/action-error.tsx';
import { windowText } from '../../environments/words.ts';

interface StepDraft {
  group: string;
  count: number;
  when: ApprovalCondition;
}

const COUNTS = [1, 2, 3, 4, 5];

/**
 * One environment's approval rule: ordered steps of a group, how many approvals and when, then
 * what happens after the last approval. The three rules every change request keeps are shown
 * on, as they are on every rule.
 */
export function RuleCard({
  environment,
  groups,
  previous,
}: {
  environment: EnvironmentV2View;
  groups: readonly { id: string; name: string }[];
  previous: string | null;
}) {
  const t = useT(environmentsText);
  const { update } = useEnvironmentV2Writes();
  const saved: StepDraft[] = environment.approvalRule?.steps ?? [];
  const [steps, setSteps] = useState<StepDraft[] | null>(null);
  const draft = steps ?? saved;
  const on = draft.length > 0;
  const name = environment.name;
  const firstGroup = groups[0]?.id;
  const edit = (index: number, patch: Partial<StepDraft>) =>
    setSteps(draft.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  const save = (next: StepDraft[]) =>
    update.mutate(
      { key: environment.key, body: { approvalRule: next.length ? { steps: next } : null } },
      { onSuccess: () => setSteps(null) },
    );
  const addStep = () =>
    firstGroup && setSteps([...draft, { group: firstGroup, count: 1, when: 'always' }]);
  const groupOptions = groups.map((group) => ({ value: group.id, label: group.name }));
  const toggle = (value: boolean) => {
    if (!value) save([]);
    else addStep();
  };
  return (
    <Card role="region" aria-label={name}>
      <CardHeader
        title={<h2 className="text-15 font-semibold">{name}</h2>}
        hint={
          on ? (
            <Badge tone="accent">{t('pipelinesEnvironments.approvals.changeRequest')}</Badge>
          ) : (
            <Badge>{t('pipelinesEnvironments.approvals.noApproval')}</Badge>
          )
        }
        actions={
          <Switch
            checked={on}
            disabled={!firstGroup && !on}
            aria-label={t('pipelinesEnvironments.approvals.ruleOn', { name })}
            onCheckedChange={toggle}
          />
        }
      />
      <CardBody className="flex flex-col gap-3.5">
        {!on ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex-1 text-13 text-tx-2">
              {firstGroup
                ? t('pipelinesEnvironments.approvals.direct')
                : t('pipelinesEnvironments.approvals.noGroups')}
            </span>
            <Button
              size="sm"
              icon={<Icon name="plus" size={14} />}
              disabled={!firstGroup}
              onClick={addStep}
            >
              {t('pipelinesEnvironments.approvals.require')}
            </Button>
          </div>
        ) : (
          <>
            <span className="text-13 text-tx-2">
              {t('pipelinesEnvironments.approvals.intro', { name })}
            </span>
            <ol className="flex flex-col gap-2">
              {draft.map((step, index) => {
                const n = index + 1;
                return (
                  <li
                    key={index}
                    className="grid grid-cols-[24px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto] items-center gap-2"
                  >
                    <span className="grid size-6 place-items-center rounded-full bg-line-2 text-12 font-semibold text-tx-2">
                      {n}
                    </span>
                    <Select
                      aria-label={t('pipelinesEnvironments.approvals.groupOf', { n })}
                      value={step.group}
                      options={
                        groupOptions.length
                          ? groupOptions
                          : [{ value: step.group, label: step.group }]
                      }
                      onChange={(e) => edit(index, { group: e.value })}
                    />
                    <Select
                      aria-label={t('pipelinesEnvironments.approvals.countOf', { n })}
                      value={String(step.count)}
                      options={COUNTS.map((count) => ({
                        value: String(count),
                        label: t('pipelinesEnvironments.approvals.count', { count }),
                      }))}
                      onChange={(e) => edit(index, { count: Number(e.value) })}
                    />
                    <Select
                      aria-label={t('pipelinesEnvironments.approvals.whenOf', { n })}
                      value={step.when}
                      options={[
                        { value: 'always', label: t('pipelinesEnvironments.approvals.always') },
                        {
                          value: 'high_risk',
                          label: t('pipelinesEnvironments.approvals.highRisk'),
                        },
                      ]}
                      onChange={(e) =>
                        edit(index, { when: e.value === 'high_risk' ? 'high_risk' : 'always' })
                      }
                    />
                    <Button
                      size="xs"
                      variant="ghost"
                      aria-label={t('pipelinesEnvironments.approvals.removeStep', { n })}
                      icon={<Icon name="minus" size={14} />}
                      onClick={() => setSteps(draft.filter((_, i) => i !== index))}
                    />
                  </li>
                );
              })}
            </ol>
            <div>
              <Button
                size="sm"
                icon={<Icon name="plus" size={14} />}
                disabled={!firstGroup}
                onClick={addStep}
              >
                {t('pipelinesEnvironments.approvals.addStep')}
              </Button>
            </div>
            <dl className="grid grid-cols-1 gap-3 text-13 sm:grid-cols-3">
              {[
                [
                  t('pipelinesEnvironments.approvals.after'),
                  t('pipelinesEnvironments.approvals.deployItself'),
                ],
                [
                  t('pipelinesEnvironments.card.window'),
                  environment.window
                    ? windowText(t, environment.window)
                    : t('pipelinesEnvironments.approvals.windowAny'),
                ],
                [
                  t('pipelinesEnvironments.card.versions'),
                  environment.versionsAllowed === 'any'
                    ? t('pipelinesEnvironments.value.anyVersion')
                    : previous
                      ? t('pipelinesEnvironments.value.passed', { previous })
                      : t('pipelinesEnvironments.value.passedPrevious'),
                ],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col gap-1">
                  <dt className="font-medium text-tx">{label}</dt>
                  <dd className="text-tx-2">{value}</dd>
                </div>
              ))}
            </dl>
            <ul className="flex flex-col gap-2 text-13 text-tx">
              {(['picks', 'notOwn', 'emergency'] as const).map((rule) => (
                <li key={rule} className="flex items-start gap-2.5">
                  <Switch
                    checked
                    disabled
                    size="sm"
                    aria-label={t(`pipelinesEnvironments.approvals.${rule}`)}
                  />
                  <span>{t(`pipelinesEnvironments.approvals.${rule}`)}</span>
                </li>
              ))}
            </ul>
            <ActionError error={update.error} />
            {steps && (
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setSteps(null)}>
                  {t('pipelinesEnvironments.dialog.cancel')}
                </Button>
                <Button variant="primary" loading={update.isPending} onClick={() => save(draft)}>
                  {t('pipelinesEnvironments.approvals.save')}
                </Button>
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
