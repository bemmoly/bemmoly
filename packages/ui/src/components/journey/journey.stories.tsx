import type { Meta, StoryObj } from '@storybook/react-vite';
import { RUN_STATE_WORDS } from '../run-glyph/states.ts';
import { Journey, type JourneyStation } from './journey.tsx';

const words = (state: keyof typeof RUN_STATE_WORDS) => RUN_STATE_WORDS[state];

/** The For you journeys from the product design. */
const CANARY: JourneyStation[] = [
  { key: 'build', label: 'Build', state: 'passed', detail: '2m' },
  { key: 'test', label: 'Test', state: 'passed', detail: '3m' },
  { key: 'dev', label: 'Dev', state: 'passed', detail: '1m' },
  { key: 'staging', label: 'Staging', state: 'passed', detail: '2m' },
  { key: 'asia', label: 'Prod asia', state: 'running', detail: '25% canary', live: true },
  { key: 'us', label: 'Prod us', state: 'queued' },
  { key: 'eu', label: 'Prod eu', state: 'queued' },
];

const FAILED: JourneyStation[] = CANARY.map((station, index) =>
  index === 0
    ? { ...station, detail: '2m', state: 'passed', live: false }
    : index === 1
      ? { ...station, state: 'failed', detail: 'unit 2 of 3', live: true }
      : { ...station, state: 'skipped', detail: undefined, live: false },
);

const meta = {
  title: 'Pipelines/Journey',
  component: Journey,
  args: {
    stations: CANARY,
    progress: 0.57,
    ariaLabel: 'Retry UPI collect on gateway timeout, from commit to Prod',
    stateLabel: words,
  },
  decorators: [
    (Story) => <div className="max-w-180 rounded-card bg-card p-4 shadow-e1">{Story()}</div>,
  ],
} satisfies Meta<typeof Journey>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Canary: Story = {};

export const CanaryDark: Story = { globals: { mode: 'dark' } };

export const WaitingForApproval: Story = {
  args: {
    stations: CANARY.map((station) =>
      station.key === 'asia' ? { ...station, state: 'waiting', detail: 'approval' } : station,
    ),
  },
};

export const FailedEarly: Story = { args: { stations: FAILED, progress: 0.08 } };

export const RolledBack: Story = {
  args: {
    stations: CANARY.map((station) =>
      station.key === 'asia'
        ? { ...station, state: 'rolled_back', detail: 'rolled back' }
        : station,
    ),
  },
};

export const Compact: Story = { args: { compact: true } };

/** At 390px the strip scrolls inside itself; the page never does. */
export const Phone: Story = {
  decorators: [(Story) => <div className="w-97.5">{Story()}</div>],
};

/** Many journeys stacked, as For you lists them. */
export const Many: Story = {
  render: (args) => (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 8 }, (_, index) => (
        <Journey key={index} {...args} stations={index % 2 ? FAILED : CANARY} />
      ))}
    </div>
  ),
};
