import type { Meta, StoryObj } from '@storybook/react-vite';
import { RUN_STATE_WORDS } from '../run-glyph/states.ts';
import { RolloutPlan, type RolloutWaveView } from './rollout-plan.tsx';

/** The Prod rollout from the product design: a canary in asia, then us and eu together. */
const WAVES: RolloutWaveView[] = [
  {
    key: '1',
    number: 1,
    title: 'asia-south1',
    steps: [
      { key: '5', label: '5%' },
      { key: '25', label: '25%' },
      { key: '100', label: '100%' },
    ],
    detail: '10 minutes each, judged on error rate and p95',
  },
  {
    key: '2',
    number: 2,
    title: 'us-east1 and eu-west1 together',
    detail: '30 minutes after wave 1 reaches 100%',
  },
];

const meta = {
  title: 'Pipelines/RolloutPlan',
  component: RolloutPlan,
  args: { waves: WAVES, ariaLabel: 'Rollout to Prod' },
  decorators: [
    (Story) => <div className="max-w-90 rounded-card bg-card p-4 shadow-e1">{Story()}</div>,
  ],
} satisfies Meta<typeof RolloutPlan>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Plan: Story = {};

export const PlanDark: Story = { globals: { mode: 'dark' } };

export const UnderWay: Story = {
  args: {
    stateLabel: (state) => RUN_STATE_WORDS[state],
    waves: WAVES.map((wave) =>
      wave.number === 1
        ? {
            ...wave,
            steps: [
              { key: '5', label: '5%', state: 'passed' },
              { key: '25', label: '25%', state: 'running' },
              { key: '100', label: '100%', state: 'queued' },
            ],
          }
        : wave,
    ),
  },
};

export const StraightToAll: Story = {
  args: { waves: [{ key: '1', number: 1, title: 'Staging', detail: 'All traffic at once' }] },
};
