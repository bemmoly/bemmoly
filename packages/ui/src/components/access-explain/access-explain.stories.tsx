import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../button/button.tsx';
import { AccessExplain } from './access-explain.tsx';

/** The checker's answer from the product design: Jon may not request a Tier 0 Prod deploy. */
const meta = {
  title: 'Pipelines/AccessExplain',
  component: AccessExplain,
  args: {
    allowed: false,
    verdict: 'Not allowed',
    sentence:
      'Jon is a Developer on checkout-api through Checkout web. Tier 0 to Prod needs a Maintainer to request it.',
    traceLabel: 'How this was decided',
    steps: [
      { key: '1', text: 'All engineering: Viewer at Acme', effect: 'grant' },
      { key: '2', text: 'Checkout web: Developer at Checkout', effect: 'grant' },
      { key: '3', text: 'Policy Tier 0 to Prod: requester must be a Maintainer', effect: 'deny' },
      { key: '4', text: 'Maintainers: Payments, the owning team', effect: 'info' },
    ],
    action: (
      <Button size="sm" variant="secondary">
        Ask Payments for access
      </Button>
    ),
  },
  decorators: [
    (Story) => <div className="max-w-80 rounded-card bg-card p-4 shadow-e1">{Story()}</div>,
  ],
} satisfies Meta<typeof AccessExplain>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NotAllowed: Story = {};

export const NotAllowedDark: Story = { globals: { mode: 'dark' } };

export const Allowed: Story = {
  args: {
    allowed: true,
    verdict: 'Allowed',
    sentence: 'Priya is a Maintainer of checkout-api because Payments owns it.',
    steps: [{ key: '1', text: 'Payments: Maintainer, the owning team', effect: 'grant' }],
    action: undefined,
  },
};
