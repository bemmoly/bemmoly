import { useT } from '@bemmoly/core-web';
import { Icon } from '@bemmoly/ui/icons';
import { setupText } from '../../../i18n/catalog.ts';
import { CLOUD_SHELL } from './guide-commands.ts';
import type { StepWhere } from './guide-steps.ts';

const WHERE = {
  cloudShell: 'pipelinesSetup.guide.where.cloudShell',
  thisMachine: 'pipelinesSetup.guide.where.thisMachine',
  compose: 'pipelinesSetup.guide.where.compose',
} as const;

/** Where a step's command runs, with Cloud Shell one click away when that is the place. */
export function StepWhereLine({ where }: { where: Exclude<StepWhere, 'here'> }) {
  const t = useT(setupText);
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-12 text-tx-2">
      <span className="flex items-center gap-1.5">
        <Icon name={where === 'cloudShell' ? 'cloud' : 'code'} size={14} className="text-tx-3" />
        {t(WHERE[where])}
      </span>
      {where === 'cloudShell' && (
        <a
          href={CLOUD_SHELL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 font-medium text-acc"
        >
          {t('pipelinesSetup.guide.where.openShell')}
          <Icon name="external" size={12} />
        </a>
      )}
    </span>
  );
}
