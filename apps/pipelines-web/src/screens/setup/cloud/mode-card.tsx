import { useT } from '@bemmoly/core-web';
import { Card, CardBody, CardHeader, Radio } from '@bemmoly/ui';
import { setupText } from '../../../i18n/catalog.ts';
import type { Guide } from './use-guide.ts';

const MODES = [
  ['attached', 'pipelinesSetup.cloud.mode.attached', 'pipelinesSetup.cloud.mode.attachedHint'],
  ['managed', 'pipelinesSetup.cloud.mode.managed', 'pipelinesSetup.cloud.mode.managedHint'],
] as const;

/** What Pipelines does: deploy into projects that exist (the default), or create them. */
export function ModeCard({ guide }: { guide: Guide }) {
  const t = useT(setupText);
  return (
    <Card>
      <CardHeader
        title={<h2 className="text-15 font-semibold">{t('pipelinesSetup.cloud.modeTitle')}</h2>}
      />
      <CardBody>
        <fieldset
          aria-label={t('pipelinesSetup.cloud.modeTitle')}
          className="flex flex-col gap-2.5"
        >
          {MODES.map(([value, label, hint]) => (
            <Radio
              key={value}
              name="mode"
              checked={guide.mode === value}
              onChange={() => guide.setMode(value)}
              label={t(label)}
              description={t(hint)}
            />
          ))}
        </fieldset>
      </CardBody>
    </Card>
  );
}
