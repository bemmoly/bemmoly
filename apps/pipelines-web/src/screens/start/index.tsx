import { useT } from '@bemmoly/core-web';
import { Button, ProvisionChecklist, type ProvisionState, type ProvisionStep } from '@bemmoly/ui';
import { useQuery } from '@tanstack/react-query';
import { platformKeys } from '../../api/platform.ts';
import { useGo } from '../../hooks/use-go.ts';
import { pipelinesText } from '../../i18n/catalog.ts';
import { api } from '../../lib/api.ts';
import { Panel, Screen } from '../../parts/screen.tsx';
import { Proposals } from './proposals.tsx';
import { useSetup, type SetupStep } from './use-setup.ts';

const ORDER: readonly SetupStep[] = ['github', 'applications', 'runners', 'cloud', 'ship'];

const WORDS = {
  todo: 'pipelines.provision.todo',
  current: 'pipelines.provision.current',
  working: 'pipelines.provision.working',
  done: 'pipelines.provision.done',
  failed: 'pipelines.provision.failed',
} as const satisfies Record<ProvisionState, string>;

/**
 * Getting an empty install to its first Prod deploy: connect GitHub, accept the applications
 * the scan found, give builds runners (or keep your CI), connect a cloud, ship. The first
 * step not done is raised with its action; done steps go quiet.
 */
export default function StartScreen() {
  const t = useT(pipelinesText);
  const go = useGo();
  const setup = useSetup();
  const proposals = useQuery({
    queryKey: platformKeys.proposals(),
    queryFn: () => api.platform.proposals(),
    retry: false,
  });
  const current = ORDER.find((step) => !setup.done[step]) ?? null;
  const stateOf = (step: SetupStep): ProvisionState =>
    setup.done[step] ? 'done' : step === current ? 'current' : 'todo';
  const action = (label: string, onClick: () => void) => (
    <Button size="sm" variant="primary" onClick={onClick}>
      {label}
    </Button>
  );
  const steps: ProvisionStep[] = [
    {
      key: 'github',
      title: t('pipelines.start.github'),
      description:
        setup.github === null && !setup.done.github
          ? t('pipelines.start.githubAdmin')
          : t('pipelines.start.githubDescription'),
      state: stateOf('github'),
      action: action(t('pipelines.start.githubAction'), () =>
        window.location.assign('/settings/code-hosts'),
      ),
    },
    {
      key: 'applications',
      title: t('pipelines.start.applications'),
      description:
        setup.proposals > 0
          ? t('pipelines.start.applicationsFound', { count: setup.proposals })
          : t('pipelines.start.applicationsDescription'),
      state: stateOf('applications'),
      action:
        setup.proposals > 0
          ? action(t('pipelines.start.review'), () =>
              document.getElementById('proposals')?.scrollIntoView({ behavior: 'smooth' }),
            )
          : undefined,
    },
    {
      key: 'runners',
      title: t('pipelines.start.runners'),
      description: t('pipelines.start.runnersDescription'),
      state: stateOf('runners'),
      action: action(t('pipelines.capacity.addPool'), () => go({ to: '/platform/capacity' })),
    },
    {
      key: 'cloud',
      title: t('pipelines.clouds.connect'),
      description: t('pipelines.start.cloudDescription'),
      state: stateOf('cloud'),
      action: action(t('pipelines.clouds.connect'), () => go({ to: '/platform/clouds/connect' })),
    },
    {
      key: 'ship',
      title: t('pipelines.start.ship'),
      description: t('pipelines.start.shipDescription'),
      state: stateOf('ship'),
      action: action(t('pipelines.start.shipAction'), () => go({ to: '/catalog' })),
    },
  ];
  const left = ORDER.filter((step) => !setup.done[step]).length;
  return (
    <Screen
      title={t('pipelines.start.title')}
      meta={left === 0 ? t('pipelines.start.allDone') : t('pipelines.start.left', { count: left })}
    >
      <Panel title={t('pipelines.start.stepsTitle')}>
        <ProvisionChecklist
          ariaLabel={t('pipelines.start.stepsTitle')}
          stateLabel={(state) => t(WORDS[state])}
          steps={steps}
          className="-mx-3"
        />
      </Panel>
      {proposals.data && proposals.data.items.length > 0 && (
        <div id="proposals">
          <Proposals items={proposals.data.items} />
        </div>
      )}
    </Screen>
  );
}
