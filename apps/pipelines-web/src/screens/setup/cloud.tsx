import { useT } from '@bemmoly/core-web';
import { Badge, Card } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { setupText } from '../../i18n/catalog.ts';
import { ScreenFrame } from '../screen-frame.tsx';
import { GuideCard } from './cloud/guide-card.tsx';
import { ModeCard } from './cloud/mode-card.tsx';
import { SignInCard } from './cloud/sign-in-card.tsx';
import { useConnectCloud } from './cloud/use-connect-cloud.ts';

const SOON = [
  'pipelinesSetup.cloud.aws',
  'pipelinesSetup.cloud.azure',
  'pipelinesSetup.cloud.kubernetes',
] as const;

/**
 * Connect a cloud, a setup checklist step (product rule 9): Google Cloud, what Pipelines does
 * there and how Bemmoly signs in, both chosen by the person; then numbered steps whose commands
 * are filled in from what they typed; Check, which says per step what is done or missing; and
 * Connect, which goes back to the checklist.
 */
export default function ConnectCloudScreen() {
  const t = useT(setupText);
  const flow = useConnectCloud({
    connected: t('pipelinesSetup.cloud.connected'),
    connectedManaged: t('pipelinesSetup.cloud.connectedManaged'),
    name: t('pipelinesSetup.cloud.name'),
  });
  return (
    <ScreenFrame
      title={t('pipelinesSetup.cloud.title')}
      heading={
        <div className="flex flex-col gap-1">
          <h1 className="text-20 leading-title font-semibold text-tx">
            {t('pipelinesSetup.cloud.title')}
          </h1>
          <span className="text-13 text-tx-2">{t('pipelinesSetup.cloud.intro')}</span>
        </div>
      }
    >
      <ul
        aria-label={t('pipelinesSetup.cloud.providers')}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <li>
          <Card className="flex h-full flex-col gap-1.5 border-acc p-3.5">
            <span className="flex items-center gap-2 font-semibold text-tx">
              <Icon name="cloud" size={16} className="text-acc" />
              {t('pipelinesSetup.cloud.gcp')}
              <Badge tone="accent" className="ms-auto">
                {t('pipelinesSetup.cloud.selected')}
              </Badge>
            </span>
            <span className="text-12 text-tx-3">{t('pipelinesSetup.cloud.gcpServices')}</span>
          </Card>
        </li>
        {SOON.map((name) => (
          <li key={name}>
            <Card className="flex h-full items-center gap-2 p-3.5 text-tx-3">
              <Icon name="cloud" size={16} />
              <span className="font-semibold">{t(name)}</span>
              <Badge className="ms-auto">{t('pipelinesSetup.cloud.soon')}</Badge>
            </Card>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <ModeCard guide={flow.guide} />
        <SignInCard guide={flow.guide} />
      </div>
      <GuideCard flow={flow} />
    </ScreenFrame>
  );
}
