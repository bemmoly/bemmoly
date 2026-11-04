import { useT } from '@bemmoly/core-web';
import { Icon } from '@bemmoly/ui/icons';
import { setupText } from '../../../i18n/catalog.ts';
import { controlEmail } from './guide-commands.ts';
import { fieldValid } from './guide-values.ts';
import type { Guide } from './use-guide.ts';

const VM_INSTANCES = 'https://console.cloud.google.com/compute/instances';

/** Switching the VM's service account in the console, the way most people will do it. */
export function AttachVmConsole({ guide }: { guide: Guide }) {
  const t = useT(setupText);
  const project = guide.values.controlProject;
  const account = fieldValid('controlProject', project) ? controlEmail(project) : 'bemmoly-control';
  return (
    <section
      aria-label={t('pipelinesSetup.guide.step.attachVmConsole')}
      className="flex flex-col gap-2 rounded-control border border-line bg-side p-3"
    >
      <a
        href={VM_INSTANCES}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-1 self-start font-semibold text-acc"
      >
        {t('pipelinesSetup.guide.step.attachVmConsole')}
        <Icon name="external" size={12} />
      </a>
      <ol className="flex list-decimal flex-col gap-1.5 ps-5 text-13 text-tx">
        <li>{t('pipelinesSetup.guide.step.attachVmStop')}</li>
        <li>{t('pipelinesSetup.guide.step.attachVmEdit')}</li>
        <li>{t('pipelinesSetup.guide.step.attachVmAccount', { account })}</li>
        <li>{t('pipelinesSetup.guide.step.attachVmScopes')}</li>
        <li>{t('pipelinesSetup.guide.step.attachVmStart')}</li>
      </ol>
      <span className="text-12 font-medium text-tx-3">
        {t('pipelinesSetup.guide.step.attachVmCommand')}
      </span>
    </section>
  );
}
