import tailwindcss from '@tailwindcss/vite';
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  // The editor's node and menu stories live beside the editor, which depends on this package.
  stories: ['../src/**/*.stories.tsx', '../../editor/src/**/*.stories.tsx'],
  // The mocks are served next to the stories so every story can show its mock crop.
  staticDirs: [{ from: '../../../docs/design/mocks', to: '/mocks' }],
  core: { disableTelemetry: true },
  async viteFinal(viteConfig) {
    viteConfig.plugins = [...(viteConfig.plugins ?? []), tailwindcss()];
    return viteConfig;
  },
};

export default config;
