import { useT } from '@bemmoly/core-web';
import { Badge } from '@bemmoly/ui';
import { useId } from 'react';
import { setupText } from '../../../i18n/catalog.ts';
import { CommandBlock } from './command-block.tsx';
import { GuideFieldInput } from './guide-field.tsx';
import type { GuideStep } from './guide-steps.ts';
import { ReachFields } from './reach-fields.tsx';
import { AttachVmConsole } from './attach-vm-console.tsx';
import { StepWhereLine } from './step-where.tsx';
import type { Guide } from './use-guide.ts';
import { WifFile } from './wif-file.tsx';

/**
 * One numbered step: what it does and why, the values it asks for, then its command filled in
 * from them, with Copy and where to run it. Until every value is there it says which are
 * missing instead of showing a command.
 */
export function GuideStepItem({
  guide,
  step,
  number,
}: {
  guide: Guide;
  step: GuideStep;
  number: number;
}) {
  const t = useT(setupText);
  const titleId = useId();
  const title = t(`pipelinesSetup.guide.step.${step.key}`);
  const fields = step.missing.filter((need) => need !== 'reach');
  return (
    <li
      aria-labelledby={titleId}
      className="flex flex-col gap-3 border-t border-line pt-4 first:border-t-0 first:pt-0"
    >
      <div className="flex flex-col gap-1">
        <h3 id={titleId} className="flex flex-wrap items-center gap-2 font-semibold text-tx">
          {t('pipelinesSetup.guide.stepTitle', { number, title })}
          {step.optional && <Badge>{t('pipelinesSetup.guide.optional')}</Badge>}
        </h3>
        <p className="text-13 text-tx-2">{t(`pipelinesSetup.guide.step.${step.key}Text`)}</p>
      </div>
      {step.key === 'grant' && <ReachFields flow={guide} />}
      {step.key === 'wifFile' && <WifFile guide={guide} />}
      {step.key === 'attachVm' && <AttachVmConsole guide={guide} />}
      {step.asks.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {step.asks.map((field) => (
            <GuideFieldInput key={field} guide={guide} field={field} />
          ))}
        </div>
      )}
      {step.where !== 'here' &&
        (step.command ? (
          <div className="flex flex-col gap-2">
            <CommandBlock
              label={t('pipelinesSetup.guide.commandLabel', { number })}
              command={step.command}
            />
            <StepWhereLine where={step.where} />
          </div>
        ) : (
          <span role="note" className="text-12 text-tx-3">
            {fields.length > 0
              ? t('pipelinesSetup.guide.fillIn', {
                  fields: fields
                    .map((field) => t(`pipelinesSetup.guide.field.${field}`))
                    .join(', '),
                })
              : t('pipelinesSetup.guide.fillReach')}
          </span>
        ))}
    </li>
  );
}
