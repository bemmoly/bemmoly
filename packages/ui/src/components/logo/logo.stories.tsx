import type { Meta, StoryObj } from '@storybook/react-vite';
import type { CSSProperties } from 'react';
import { buildTheme, themeStyle } from '../../theme/index.ts';
import { PRESETS } from '../../tokens/presets.ts';
import { Logo, type LogoTone } from './logo.tsx';

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

/** Custom brand themes are the one case where the mark takes the workspace's colours. */
const CUSTOM_BRANDS = [
  buildTheme({ brand: '#0f766e', mode: 'light', surfaces: 'neutral', font: 'plex' }),
  buildTheme({ brand: '#c2410c', mode: 'dark', surfaces: 'neutral', font: 'plex' }),
];

/** The builder's tokens as React style: CSS variables, and color-scheme under React's name. */
function customStyle(theme: (typeof CUSTOM_BRANDS)[number]): CSSProperties {
  const { 'color-scheme': colorScheme, ...variables } = themeStyle(theme);
  return { ...variables, colorScheme } as CSSProperties;
}

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
      {CUSTOM_BRANDS.map((theme) => (
        <div
          key={theme.input.brand}
          data-theme={theme.id}
          style={customStyle(theme)}
          className="flex flex-col gap-3 rounded-card border border-br bg-sf p-4"
        >
          <span className="text-11 text-tx5">
            Custom {theme.input.brand}, {theme.mode}
          </span>
          <Logo variant="lockup" />
        </div>
      ))}
    </div>
  ),
};
