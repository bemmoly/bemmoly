import { useT } from '@bemmoly/core-web';
import { Card, CardBody, CardHeader } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { setupText } from '../../../i18n/catalog.ts';
import { CheckPanel } from './check-panel.tsx';
import { GuideStepItem } from './guide-step.tsx';
import type { ConnectCloud } from './use-connect-cloud.ts';

/** The numbered steps for the person's choices, then Check and Connect. */
export function GuideCard({ flow }: { flow: ConnectCloud }) {
  const t = useT(setupText);
  const { guide } = flow;
  if (!guide.signIn) {
    return (
      <div
        role="note"
        className="flex items-start gap-2 rounded-control bg-acc-50 px-3 py-2.5 text-13 text-tx"
      >
        <Icon name="info" size={16} className="mt-0.5 shrink-0 text-acc" />
        <span>{t('pipelinesSetup.guide.choose')}</span>
      </div>
    );
  }
  return (
    <Card>
      <CardHeader
        title={<h2 className="text-15 font-semibold">{t('pipelinesSetup.guide.title')}</h2>}
        hint={t('pipelinesSetup.guide.hint')}
      />
      <CardBody className="flex flex-col gap-4">
        <ol aria-label={t('pipelinesSetup.guide.label')} className="flex flex-col gap-4">
          {guide.steps.map((step, index) => (
            <GuideStepItem key={step.key} guide={guide} step={step} number={index + 1} />
          ))}
        </ol>
        <CheckPanel flow={flow} />
      </CardBody>
    </Card>
  );
}
