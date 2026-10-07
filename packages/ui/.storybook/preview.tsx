import type { Decorator, Preview } from '@storybook/react-vite';
import { useEffect } from 'react';
import { DEFAULT_PRESET, THEMES } from '../src/tokens.ts';
import './preview.css';

const ThemeDecorator: Decorator = (Story, context) => {
  const theme = String(context.globals['theme'] ?? DEFAULT_PRESET);
  useEffect(() => {
    document.documentElement.dataset['theme'] = theme;
  }, [theme]);
  return <Story />;
};

const preview: Preview = {
  decorators: [ThemeDecorator],
  globalTypes: {
    theme: {
      description: 'Theme preset',
      toolbar: {
        title: 'Theme',
        items: THEMES.map((theme) => ({ value: theme.id, title: `${theme.name} (${theme.mode})` })),
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: DEFAULT_PRESET },
  parameters: { layout: 'centered' },
};

export default preview;
