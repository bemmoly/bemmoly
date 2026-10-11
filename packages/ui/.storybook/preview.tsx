import type { Decorator, Preview } from '@storybook/react-vite';
import { useEffect } from 'react';
import { applyTheme, clearTheme, customThemeSource } from '../src/theme/index.ts';
import { DEFAULT_THEME, resolveSource, THEME_SOURCES } from '../src/tokens.ts';
import { SideBySide, type MockCrop } from './mock-frame.tsx';
import './preview.css';

/** A custom theme as the generator builds it: a company's own teal on neutral surfaces. */
const CUSTOM_BRAND = '#0f766e';

function useTheme(theme: string, mode: string) {
  useEffect(() => {
    const root = document.documentElement;
    const wanted = mode === 'dark' ? 'dark' : 'light';
    if (theme !== 'custom') {
      clearTheme(root, theme);
      root.dataset['mode'] = wanted;
      return;
    }
    const source = customThemeSource('custom', 'Custom', { brand: CUSTOM_BRAND, surface: 'neutral' });
    applyTheme(root, resolveSource(source, wanted));
  }, [theme, mode]);
}


const ThemeDecorator: Decorator = (Story, context) => {
  useTheme(
    String(context.globals['theme'] ?? DEFAULT_THEME),
    String(context.globals['mode'] ?? 'light'),
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
      description: 'Theme',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          ...THEME_SOURCES.map((t) => ({ value: t.id, title: t.name })),
          { value: 'custom', title: `Custom ${CUSTOM_BRAND}` },
        ],
        dynamicTitle: true,
      },
    },
    mode: {
      description: 'Light or dark: every theme is designed in both',
      toolbar: {
        title: 'Mode',
        icon: 'contrast',
        items: [
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
  initialGlobals: { theme: DEFAULT_THEME, mode: 'light', mock: 'side' },
  parameters: {
    layout: 'padded',
    // The design system's front page first; its rules live in docs/design/system.
    options: {
      storySort: { order: ['Design system', 'Foundations', 'Components', 'Docs', 'Editor'] },
    },
  },
};

export default preview;
