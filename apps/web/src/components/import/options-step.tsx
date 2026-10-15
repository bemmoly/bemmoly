import type { ImportJob, ImportSource } from '@bemmoly/shared';
import { Button } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useId } from 'react';
import { useImportOptions } from '../../hooks/use-import-options.ts';
import { FormError } from '../form.tsx';
import { OptionsBring } from './options-bring.tsx';
import { OptionsFinePrint } from './options-fine-print.tsx';
import { OptionsPeople } from './options-people.tsx';
import { OptionsTargets } from './options-targets.tsx';

interface OptionsStepProps {
  job: ImportJob;
  source: ImportSource | null;
  onBack: () => void;
  onReview: () => void;
}

/**
 * Options and mapping: one page of decisions in the order people think (what to bring, where
 * each goes, who the people are, the fine print), then Review import, which waits while a
 * key needs fixing.
 */
export function OptionsStep({ job, source, onBack, onReview }: OptionsStepProps) {
  const options = useImportOptions(job, source);
  const hintId = useId();
  const { targets } = options;
  const { firstError, unpicked } = targets;
  const hint = firstError
    ? `Fix the key for ${firstError.key ?? firstError.name} to continue.`
    : unpicked
      ? `Choose where ${unpicked.key ?? unpicked.name} goes to continue.`
      : options.blocked
        ? 'Saving your choices.'
        : null;
  return (
    <div className="flex flex-col gap-6">
      {options.options.length > 0 ? <OptionsBring options={options} /> : null}
      <OptionsTargets options={options} />
      <OptionsPeople options={options} />
      <OptionsFinePrint options={options} />
      <FormError error={options.error} />
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" icon={<Icon name="back" />} onClick={onBack}>
            Back
          </Button>
          <Button
            variant="primary"
            disabled={options.blocked}
            aria-describedby={hint ? hintId : undefined}
            onClick={onReview}
          >
            Review import
          </Button>
        </div>
        {hint ? (
          <p id={hintId} className="m-0 text-12 text-tx-3" aria-live="polite">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
