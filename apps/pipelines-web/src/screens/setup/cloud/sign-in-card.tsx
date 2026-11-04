import { useT } from '@bemmoly/core-web';
import { Card, CardBody, CardHeader, Radio } from '@bemmoly/ui';
import { setupText } from '../../../i18n/catalog.ts';
import type { GuideSignIn } from './guide-steps.ts';
import type { Guide } from './use-guide.ts';

const CHOICES = [
  ['vm', 'pipelinesSetup.cloud.signIn.vm', 'pipelinesSetup.cloud.signIn.vmHint'],
  [
    'application_default',
    'pipelinesSetup.cloud.signIn.gcloud',
    'pipelinesSetup.cloud.signIn.gcloudHint',
  ],
] as const satisfies readonly (readonly [GuideSignIn, string, string])[];

/**
 * How Bemmoly signs in: nothing is picked for the person. The machine's account and a gcloud
 * sign-in cover most installs; the workload identity file sits apart as the advanced choice.
 */
export function SignInCard({ guide }: { guide: Guide }) {
  const t = useT(setupText);
  return (
    <Card>
      <CardHeader
        title={<h2 className="text-15 font-semibold">{t('pipelinesSetup.cloud.signInTitle')}</h2>}
      />
      <CardBody>
        <fieldset
          aria-label={t('pipelinesSetup.cloud.signInTitle')}
          className="flex flex-col gap-2.5"
        >
          {CHOICES.map(([value, label, hint]) => (
            <Radio
              key={value}
              name="sign-in"
              checked={guide.signIn === value}
              onChange={() => guide.setSignIn(value)}
              label={t(label)}
              description={t(hint)}
            />
          ))}
          <span className="mt-1 border-t border-line pt-2.5 text-12 font-medium text-tx-3">
            {t('pipelinesSetup.cloud.signIn.advanced')}
          </span>
          <Radio
            name="sign-in"
            checked={guide.signIn === 'workload_identity_file'}
            onChange={() => guide.setSignIn('workload_identity_file')}
            label={t('pipelinesSetup.cloud.signIn.wif')}
            description={t('pipelinesSetup.cloud.signIn.wifHint')}
          />
        </fieldset>
      </CardBody>
    </Card>
  );
}
