import { useT } from '@bemmoly/core-web';
import type { Environment, EnvironmentPath, Tier } from '@bemmoly/module-pipelines/shared';
import { Button, Checkbox, IconButton, Input, Modal, Select } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState, type KeyboardEvent } from 'react';
import { TIERS, useEnvironmentWrites } from '../../../hooks/use-environments.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { ActionError } from '../../../parts/action-error.tsx';
import {
  addStep,
  addable,
  draftOfPath,
  moveStep,
  pathBodyOf,
  removeStep,
  setStep,
  stageAt,
  type StepDraft,
} from './path-draft.ts';

/** One grid for the heading and every step, so the columns line up. */
const ROW = 'grid grid-cols-[minmax(0,1fr)_4rem_5rem_auto_auto] items-center gap-x-3';

const count = (value: string, max: number) =>
  Math.min(max, Math.max(0, Math.floor(Number(value) || 0)));

/**
 * Edit path: the environments a tier's releases cross, in order, each with its stage, how
 * long it bakes and whether it promotes on its own. "Use the same path for every tier" saves
 * this one to all three. Mounted per opening, so it starts from what is saved.
 */
export function PathDialog({
  tier,
  path,
  environments,
  onClose,
}: {
  tier: Tier;
  path: EnvironmentPath | undefined;
  environments: readonly Environment[];
  onClose: () => void;
}) {
  const t = useT(pipelinesText);
  const { setPath } = useEnvironmentWrites();
  const [steps, setSteps] = useState<StepDraft[]>(() => draftOfPath(path));
  const [everyTier, setEveryTier] = useState(false);
  const offered = addable(environments, steps);
  const save = () => {
    if (steps.length === 0 || setPath.isPending) return;
    setPath.mutate(
      { tiers: everyTier ? TIERS : [tier], body: pathBodyOf(steps) },
      { onSuccess: onClose },
    );
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      save();
    }
  };
  return (
    <Modal
      open
      width="lg"
      onClose={onClose}
      title={t('pipelines.environments.pathTitle', { tier })}
      description={t('pipelines.environments.pathDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('pipelines.common.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={steps.length === 0}
            loading={setPath.isPending}
            onClick={save}
          >
            {everyTier
              ? t('pipelines.environments.saveEveryTier')
              : t('pipelines.environments.savePath')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5" onKeyDown={onKeyDown}>
        {steps.length === 0 ? (
          <p className="rounded-control bg-sunken px-3 py-2 text-12 text-tx-2">
            {t('pipelines.environments.pathEmpty')}
          </p>
        ) : (
          <div className="flex flex-col">
            <div
              aria-hidden
              className={`${ROW} border-b border-line-2 pb-1.5 text-11 font-semibold text-tx-3`}
            >
              <span>{t('pipelines.environments.name')}</span>
              <span>{t('pipelines.environments.stage')}</span>
              <span>{t('pipelines.environments.bakeMinutes')}</span>
              <span className="col-span-2">{t('pipelines.environments.autoPromote')}</span>
            </div>
            <ol aria-label={t('pipelines.environments.pathSteps', { tier })}>
              {steps.map((step, index) => (
                <li
                  key={step.environmentId}
                  className={`${ROW} border-b border-line-2 py-1.5 last:border-b-0`}
                >
                  <span className="flex min-w-0 items-center gap-1.5 text-13 font-medium text-tx">
                    {step.class === 'prod' && (
                      <Icon name="shield" size={12} className="shrink-0 text-tx-2" />
                    )}
                    <span className="truncate">{step.name}</span>
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    value={stageAt(steps, index)}
                    aria-label={t('pipelines.environments.stageOf', { name: step.name })}
                    onChange={(event) =>
                      setSteps(setStep(steps, index, { stage: count(event.target.value, 50) }))
                    }
                  />
                  <Input
                    type="number"
                    min={0}
                    value={step.bakeMinutes}
                    aria-label={t('pipelines.environments.bakeOf', { name: step.name })}
                    onChange={(event) =>
                      setSteps(
                        setStep(steps, index, { bakeMinutes: count(event.target.value, 10_080) }),
                      )
                    }
                  />
                  <Checkbox
                    checked={step.autoPromote}
                    aria-label={t('pipelines.environments.autoPromoteOf', { name: step.name })}
                    onChange={(event) =>
                      setSteps(setStep(steps, index, { autoPromote: event.target.checked }))
                    }
                  />
                  <span className="flex">
                    <IconButton
                      size="sm"
                      icon="arrow-up"
                      disabled={index === 0}
                      label={t('pipelines.environments.moveUp', { name: step.name })}
                      onClick={() => setSteps(moveStep(steps, index, -1))}
                    />
                    <IconButton
                      size="sm"
                      icon="arrow-down"
                      disabled={index === steps.length - 1}
                      label={t('pipelines.environments.moveDown', { name: step.name })}
                      onClick={() => setSteps(moveStep(steps, index, 1))}
                    />
                    <IconButton
                      size="sm"
                      icon="close"
                      label={t('pipelines.environments.removeStep', { name: step.name })}
                      onClick={() => setSteps(removeStep(steps, index))}
                    />
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {offered.length > 0 && (
          <Select
            value=""
            searchable
            placeholder={t('pipelines.environments.addStep')}
            aria-label={t('pipelines.environments.addStep')}
            options={offered.map((environment) => ({
              value: environment.id,
              label: environment.name,
              description: environment.key,
            }))}
            onChange={(event) => {
              const environment = offered.find((item) => item.id === event.value);
              if (environment) setSteps(addStep(steps, environment));
            }}
          />
        )}
        <Checkbox
          checked={everyTier}
          label={t('pipelines.environments.everyTier')}
          description={t('pipelines.environments.everyTierHint')}
          onChange={(event) => setEveryTier(event.target.checked)}
        />
        <ActionError error={setPath.error} />
      </div>
    </Modal>
  );
}
