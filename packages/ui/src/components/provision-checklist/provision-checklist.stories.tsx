import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../button/button.tsx';
import {
  ProvisionChecklist,
  type ProvisionState,
  type ProvisionStep,
} from './provision-checklist.tsx';

const WORDS: Record<ProvisionState, string> = {
  todo: 'Not started',
  current: 'Next',
  working: 'In progress',
  done: 'Done',
  failed: 'Failed',
};

/** An empty install's first steps. */
const START: ProvisionStep[] = [
  {
    key: 'github',
    title: 'Scan GitHub',
    description: '800 repositories scanned, 1,140 applications proposed.',
    state: 'done',
  },
  {
    key: 'cloud',
    title: 'Connect a cloud',
    description: 'Pick a provider and how environments map to projects.',
    state: 'current',
    action: <Button size="sm">Connect a cloud</Button>,
  },
  {
    key: 'ship',
    title: 'Ship a first application',
    description: 'Promote one release from Dev to Prod.',
    state: 'todo',
  },
];

const meta = {
  title: 'Pipelines/ProvisionChecklist',
  component: ProvisionChecklist,
  args: { steps: START, ariaLabel: 'Get started', stateLabel: (state) => WORDS[state] },
  decorators: [
    (Story) => <div className="max-w-130 rounded-card bg-card p-3 shadow-e1">{Story()}</div>,
  ],
} satisfies Meta<typeof ProvisionChecklist>;

export default meta;

type Story = StoryObj<typeof meta>;

export const GettingStarted: Story = {};

export const GettingStartedDark: Story = { globals: { mode: 'dark' } };

export const CreatingProjects: Story = {
  args: {
    steps: [
      { key: 'folder', title: 'Folder Bemmoly', state: 'done' },
      { key: 'ci', title: 'acme-ci', description: 'Runners, registry, caches', state: 'done' },
      { key: 'dev', title: 'acme-commerce-dev', state: 'working' },
      {
        key: 'prod',
        title: 'acme-commerce-prod',
        description: 'Billing account refused the link. Check the billing role, then retry.',
        state: 'failed',
        action: (
          <Button size="sm" variant="secondary">
            Try again
          </Button>
        ),
      },
      { key: 'more', title: '23 more projects', state: 'todo' },
    ],
  },
};
