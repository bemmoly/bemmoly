import type { Meta, StoryObj } from '@storybook/react-vite';
import type { CSSProperties } from 'react';
import { customThemeSource, themeStyle } from '../../theme/index.ts';
import { resolveSource } from '../../tokens/resolve.ts';
import { THEME_SOURCES } from '../../tokens/themes.ts';
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
    <div className="flex h-topbar items-center bg-card px-2">
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
          className="flex flex-col gap-3 rounded-card border border-line bg-sunken p-4"
        >
          <span className="text-11 font-medium tracking-caps text-tx-3 uppercase">
            {surface} surface
          </span>
          {TONES.map((tone) => (
            <div key={tone} className="flex items-center gap-6">
              <span className="w-12 font-mono text-11 text-tx-3">{tone}</span>
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

/** Custom themes never recolour the mark either: it keeps its designed colours on all of them. */
const CUSTOM_BRANDS = [
  resolveSource(
    customThemeSource('teal', 'Teal', { brand: '#0f766e', surface: 'neutral' }),
    'light',
  ),
  resolveSource(customThemeSource('rust', 'Rust', { brand: '#c2410c', surface: 'warm' }), 'dark'),
];

/** The theme's tokens as React style: CSS variables, and color-scheme under React's name. */
function customStyle(theme: (typeof CUSTOM_BRANDS)[number]): CSSProperties {
  const { 'color-scheme': colorScheme, ...variables } = themeStyle(theme);
  return { ...variables, colorScheme } as CSSProperties;
}

export const AcrossThemes: Story = {
  render: () => (
    <div className="grid grid-cols-4 gap-3">
      {THEME_SOURCES.flatMap((theme) =>
        (['light', 'dark'] as const).map((mode) => (
          <div
            key={`${theme.id}-${mode}`}
            data-theme={theme.id}
            data-mode={mode}
            className="flex flex-col gap-3 rounded-card border border-line bg-card p-4"
          >
            <span className="text-11 text-tx-3">
              {theme.name}, {mode}
            </span>
            <Logo variant="lockup" />
          </div>
        )),
      )}
      {CUSTOM_BRANDS.map((theme) => (
        <div
          key={theme.id}
          data-theme={theme.id}
          style={customStyle(theme)}
          className="flex flex-col gap-3 rounded-card border border-line bg-card p-4"
        >
          <span className="text-11 text-tx-3">
            Custom {theme.name}, {theme.mode}
          </span>
          <Logo variant="lockup" />
        </div>
      ))}
    </div>
  ),
};
