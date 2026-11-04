import { useT } from '@bemmoly/core-web';
import type { EnvironmentV2View, SetupChecklistResponse } from '@bemmoly/module-pipelines/shared';
import { Card, CardBody, CardHeader } from '@bemmoly/ui';
import type { ReactNode } from 'react';
import { setupText } from '../../../i18n/catalog.ts';
import { cx } from '../../../lib/cx.ts';

function Row({ name, value, off }: { name: string; value: ReactNode; off: boolean }) {
  return (
    <div className="flex items-start gap-3 border-b border-line-2 py-2.25 text-13 last:border-b-0">
      <dt className="flex-1 text-tx">{name}</dt>
      <dd className={cx('text-end', off ? 'text-tx-3' : 'text-tx')}>{value}</dd>
    </div>
  );
}

/** What's switched on: everything starts off, and each row says so until someone turns it on. */
export function SwitchedOn({
  summary,
  environments,
}: {
  summary: SetupChecklistResponse['switchedOn'];
  environments: readonly EnvironmentV2View[];
}) {
  const t = useT(setupText);
  const none = t('pipelinesSetup.on.none');
  const off = t('pipelinesSetup.on.off');
  const rules = environments.flatMap((environment) =>
    environment.approvalSteps.map((step) =>
      t('pipelinesSetup.on.approvalRule', {
        environment: environment.name,
        count: step.count,
        group: step.groupRef.name,
      }),
    ),
  );
  const schemes = summary.versionSchemes.map((scheme) => t(`pipelinesSetup.scheme.${scheme}`));
  return (
    <Card>
      <CardHeader
        title={<h2 className="text-15 font-semibold">{t('pipelinesSetup.on.title')}</h2>}
      />
      <CardBody>
        <dl aria-label={t('pipelinesSetup.on.title')}>
          <Row
            name={t('pipelinesSetup.on.clouds')}
            value={summary.clouds.join(', ') || none}
            off={summary.clouds.length === 0}
          />
          <Row
            name={t('pipelinesSetup.on.environments')}
            value={environments.map((environment) => environment.name).join(', ') || none}
            off={environments.length === 0}
          />
          <Row
            name={t('pipelinesSetup.on.approvals')}
            value={
              rules.length ? (
                <span className="flex flex-col">
                  {rules.map((rule) => (
                    <span key={rule}>{rule}</span>
                  ))}
                </span>
              ) : (
                none
              )
            }
            off={rules.length === 0}
          />
          <Row
            name={t('pipelinesSetup.on.deployOnPush')}
            value={summary.deployOnPush ? t('pipelinesSetup.on.onValue') : off}
            off={!summary.deployOnPush}
          />
          <Row name={t('pipelinesSetup.on.requiredSteps')} value={none} off />
          <Row name={t('pipelinesSetup.on.scans')} value={off} off />
          <Row
            name={t('pipelinesSetup.on.versions')}
            value={schemes.join(', ') || t('pipelinesSetup.on.notChosen')}
            off={schemes.length === 0}
          />
          <Row name={t('pipelinesSetup.on.notifications')} value={off} off />
        </dl>
        <p className="mt-3 text-12 text-tx-3">{t('pipelinesSetup.on.footer')}</p>
      </CardBody>
    </Card>
  );
}
