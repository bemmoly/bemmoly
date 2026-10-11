import type { Meta, StoryObj } from '@storybook/react-vite';
import { Kbd } from './kbd.tsx';

const meta = { title: 'Foundations/Kbd', component: Kbd } satisfies Meta<typeof Kbd>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Chords and runs of keys, in a chip and plain. Off Apple platforms Mod reads "Ctrl". */
export const Shortcuts: Story = {
  args: { keys: 'Mod+K' },
  render: () => (
    <div className="flex flex-col gap-3 text-12 text-tx-2">
      {['Mod+K', 'C', '/', 'Esc', 'Up Down', 'Enter', 'Mod+Enter', 'Mod+Shift+P', 'Mod+Alt+M'].map(
        (keys) => (
          <span key={keys} className="flex items-center gap-3">
            <Kbd keys={keys} />
            <Kbd keys={keys} variant="plain" />
            <code className="font-mono text-11 text-tx-3">{keys}</code>
          </span>
        ),
      )}
    </div>
  ),
};
