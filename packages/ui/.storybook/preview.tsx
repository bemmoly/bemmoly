import type { Decorator, Preview } from '@storybook/react-vite';
import { useEffect } from 'react';
import { applyTheme, buildTheme, clearTheme } from '../src/theme/index.ts';
import { DEFAULT_PRESET, PRESETS } from '../src/tokens.ts';
import { SideBySide, type MockCrop } from './mock-frame.tsx';
import './preview.css';

/** The custom theme of the Themes mock (2i): a company's own orange on tinted surfaces. */
const CUSTOM_BRAND = '#f97316';

function useTheme(theme: string, mode: string) {
  useEffect(() => {
    const root = document.documentElement;
    const preset = PRESETS.find((p) => p.id === theme);
    const wanted = mode === 'auto' ? (preset?.mode ?? 'light') : mode;
    if (preset && preset.mode === wanted) {
      clearTheme(root, preset.id);
      return;
    }
    applyTheme(
      root,
      buildTheme({
        brand: preset?.accent[0] ?? CUSTOM_BRAND,
        mode: wanted === 'dark' ? 'dark' : 'light',
        surfaces: preset ? 'neutral' : 'tinted',
        font: preset?.font ?? 'plex',
      }),
    );
  }, [theme, mode]);
}

const ThemeDecorator: Decorator = (Story, context) => {
  useTheme(
    String(context.globals['theme'] ?? DEFAULT_PRESET),
    String(context.globals['mode'] ?? 'auto'),
  );
  return <Story />;
};

const MockDecorator: Decorator = (Story, context) => {
  const crops = context.parameters['mock'] as MockCrop[] | undefined;
  if (!crops?.length || context.globals['mock'] === 'off') return <Story />;
  return (
    <SideBySide crops={crops}>
      <Story />
    </SideBySide>
  );
};

const preview: Preview = {
  decorators: [MockDecorator, ThemeDecorator],
  globalTypes: {
    theme: {
      description: 'Theme preset',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          ...PRESETS.map((p) => ({ value: p.id, title: `${p.name} (${p.mode})` })),
          { value: 'custom', title: `Custom ${CUSTOM_BRAND}, tinted` },
        ],
        dynamicTitle: true,
      },
    },
    mode: {
      description: 'Light or dark; a preset in the other mode is rebuilt with buildTheme',
      toolbar: {
        title: 'Mode',
        icon: 'contrast',
        items: [
          { value: 'auto', title: 'Preset mode' },
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
    mock: {
      description: 'Show the mock crop beside each story',
      toolbar: {
        title: 'Mock',
        icon: 'sidebaralt',
        items: [
          { value: 'side', title: 'Mock side by side' },
          { value: 'off', title: 'Component only' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: DEFAULT_PRESET, mode: 'auto', mock: 'side' },
  parameters: { layout: 'padded' },
};

export default preview;
