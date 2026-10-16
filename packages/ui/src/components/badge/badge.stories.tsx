import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge, type BadgeTone } from './badge.tsx';

const meta = {
  title: 'Components/Badge',
  component: Badge,
  args: { tone: 'neutral', children: 'Label' },
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

const TONES: BadgeTone[] = ['neutral', 'accent', 'ok', 'warn', 'danger', 'solid', 'outline'];

/** Every tone as a label and as a count; danger is for failure only ("1 failed"). */
function Sheet() {
  return (
    <div className="flex flex-col gap-2">
      {TONES.map((tone) => (
        <div key={tone} className="flex items-center gap-2 text-12 text-tx-2">
          <Badge tone={tone}>{tone}</Badge>
          <Badge tone={tone} variant="count">
            12
          </Badge>
        </div>
      ))}
    </div>
  );
}

export const Tones: Story = { render: () => <Sheet /> };

export const TonesDark: Story = { render: () => <Sheet />, globals: { mode: 'dark' } };

export const Danger: Story = { args: { tone: 'danger', children: '1 failed' } };
