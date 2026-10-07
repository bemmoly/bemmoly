import type { Meta, StoryObj } from '@storybook/react-vite';
import { PRESETS } from '../../tokens/presets.ts';
import { Logo, type LogoTone } from './logo.tsx';
import { WorkspaceMark } from './workspace-mark.tsx';

const meta = {
  title: 'Components/Logo',
  component: Logo,
  args: { variant: 'lockup', tone: 'auto', size: 24 },
  argTypes: {
    variant: { control: 'inline-radio', options: ['mark', 'wordmark', 'lockup'] },
    tone: { control: 'inline-radio', options: ['auto', 'light', 'dark', 'mono'] },
  },
} satisfies Meta<typeof Logo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  parameters: {
    mock: [
      { file: 'Bemmoly Board.dc.html', x: 8, y: 0, w: 130, h: 48, note: 'top bar brand block' },
    ],
  },
  render: (args) => (
    <div className="flex h-topbar items-center bg-sf px-2">
      <Logo {...args} />
    </div>
  ),
};

const TONES: LogoTone[] = ['auto', 'dark', 'mono', 'light'];

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {(['light', 'dark'] as const).map((surface) => (
        <div
          key={surface}
          data-theme={surface}
          className="flex flex-col gap-3 rounded-card border border-br bg-bg p-4"
        >
          <span className="text-11 font-medium tracking-caps text-tx5 uppercase">
            {surface} surface
          </span>
          {TONES.map((tone) => (
            <div key={tone} className="flex items-center gap-6">
              <span className="w-12 font-mono text-11 text-tx4">{tone}</span>
              <Logo variant="mark" tone={tone} />
              <Logo variant="wordmark" tone={tone} />
              <Logo variant="lockup" tone={tone} />
              <Logo variant="mark" tone={tone} size={48} />
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
};

export const AcrossPresets: Story = {
  render: () => (
    <div className="grid grid-cols-4 gap-3">
      {PRESETS.map((preset) => (
        <div
          key={preset.id}
          data-theme={preset.id}
          className="flex flex-col gap-3 rounded-card border border-br bg-sf p-4"
        >
          <span className="text-11 text-tx5">{preset.name}</span>
          <Logo variant="lockup" />
        </div>
      ))}
    </div>
  ),
};

export const WorkspaceMarks: Story = {
  parameters: {
    mock: [
      {
        file: 'Bemmoly Appearance Settings.dc.html',
        x: 300,
        y: 560,
        w: 420,
        h: 70,
        note: 'logo row',
      },
    ],
  },
  render: () => (
    <div className="flex items-center gap-3">
      <WorkspaceMark name="Acme Labs" />
      <WorkspaceMark name="Engineering" size={30} />
    </div>
  ),
};
