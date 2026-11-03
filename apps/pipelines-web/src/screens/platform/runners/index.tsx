import { useT } from '@bemmoly/core-web';
import { Button, Card, CardBody } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useNavigate } from '@tanstack/react-router';
import { runsText } from '../../../i18n/catalog.ts';

const CAPACITY: string = '/platform/capacity';

/**
 * Platform › Runners: jobs run in Cloud Build in the environment's own project, with nothing
 * to install; a runner of your own is for a private network, a GPU or a machine you have.
 */
export default function RunnersScreen() {
  const t = useT(runsText);
  const navigate = useNavigate();
  return (
    <div className="mx-auto flex w-full max-w-360 flex-col gap-4 px-4 py-5 md:px-6">
      <Card>
        <CardBody className="flex flex-col gap-2.5">
          <h2 className="text-16 font-semibold text-tx">{t('pipelinesRuns.runners.heading')}</h2>
          <p className="m-0 text-13 text-tx-2">{t('pipelinesRuns.runners.body')}</p>
          <div>
            <Button
              icon={<Icon name="plus" size={14} />}
              onClick={() => void navigate({ to: CAPACITY })}
            >
              {t('pipelinesRuns.runners.add')}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
