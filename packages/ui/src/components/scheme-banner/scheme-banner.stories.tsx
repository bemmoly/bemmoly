import type { Meta, StoryObj } from '@storybook/react-vite';
import { SchemeOverrideBanner } from './scheme-banner.tsx';

const meta = {
  title: 'Components/SchemeOverrideBanner',
  component: SchemeOverrideBanner,
  args: {
    scheme: 'Org default: Software (Scrum)',
    onPickScheme: () => {},
    overrideCount: 2,
    onViewDiff: () => {},
  },
} satisfies Meta<typeof SchemeOverrideBanner>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The "Inherits from" bar under the Board Settings header. */
export const Inherits: Story = {
  parameters: {
    layout: 'fullscreen',
    mock: [
      { file: 'Bemmoly Board Settings.dc.html', x: 272, y: 206, w: 896, h: 40, note: 'banner' },
    ],
  },
  render: (args) => (
    <div className="w-224 bg-bg">
      <SchemeOverrideBanner {...args} />
    </div>
  ),
};

/** With a reset action beside the diff link. */
export const WithReset: Story = {
  args: { overrideCount: 1, onReset: () => {} },
  parameters: { layout: 'fullscreen', mock: undefined },
  render: (args) => (
    <div className="w-224 bg-bg">
      <SchemeOverrideBanner {...args} />
    </div>
  ),
};
