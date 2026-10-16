import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from '../avatar/avatar.tsx';
import { GateList, type GateItem, type GateState } from './gate-list.tsx';

const WORDS: Record<GateState, string> = { pass: 'Passed', fail: 'Failed', pending: 'Waiting' };

/** The Promote to Prod gates from the product design. */
const GATES: GateItem[] = [
  {
    key: 'tests',
    state: 'pass',
    label: 'Tests and security',
    reason: '198 tests, 0 high findings',
  },
  { key: 'staging', state: 'pass', label: 'Healthy in Staging', reason: '31 minutes, needs 30' },
  { key: 'budget', state: 'pass', label: 'Error budget', reason: '62% left this month' },
  { key: 'freeze', state: 'pass', label: 'No freeze', reason: 'next freeze 20 December' },
  { key: 'window', state: 'pass', label: 'Deploy window', reason: 'open until 16:00' },
  {
    key: 'approvals',
    state: 'pending',
    label: 'Approvals, 1 of 3',
    children: (
      <span className="mt-1 flex items-center gap-1.5 text-12 text-tx-2">
        <Avatar name="Priya Sharma" size={18} />
        Priya S. approved
      </span>
    ),
  },
];

const meta = {
  title: 'Pipelines/GateList',
  component: GateList,
  args: { gates: GATES, ariaLabel: 'Gates for Prod', stateLabel: (state) => WORDS[state] },
  decorators: [
    (Story) => <div className="max-w-90 rounded-card bg-card p-4 shadow-e1">{Story()}</div>,
  ],
} satisfies Meta<typeof GateList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WaitingForApprovals: Story = {};

export const WaitingForApprovalsDark: Story = { globals: { mode: 'dark' } };

export const OneFailing: Story = {
  args: {
    gates: GATES.map((gate) =>
      gate.key === 'staging'
        ? { ...gate, state: 'fail', reason: '5xx rate 2.4%, needs under 1%' }
        : gate,
    ),
  },
};

export const MetricsUnavailable: Story = {
  args: {
    gates: [
      { key: 'budget', state: 'pending', label: 'Error budget', reason: 'No metrics source yet' },
    ],
  },
};
