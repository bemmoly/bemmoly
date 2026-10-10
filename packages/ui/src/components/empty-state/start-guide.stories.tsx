import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../button/index.ts';
import { SpaceTile } from '../space-card/space-tile.tsx';
import { StartGuide } from './start-guide.tsx';

const art = (
  <span className="flex gap-1.5">
    <SpaceTile name="Engineering" tone="accent" />
    <SpaceTile name="Product" tone="violet" />
    <SpaceTile name="Operations" tone="slate" />
  </span>
);

const meta = {
  title: 'Docs/Start guide',
  component: StartGuide,
  args: {
    art,
    title: 'Write it down once, find it forever',
    description:
      'Docs keeps your team’s specs, runbooks and decisions in spaces, next to the work they describe.',
    steps: [
      {
        title: 'Create a space',
        description: 'A space is a home for one team or topic, with its own pages and people.',
        action: <Button size="sm">Create space</Button>,
      },
      {
        title: 'Write the first page',
        description: 'Start blank or from a template: an RFC, a runbook, meeting notes.',
        action: (
          <Button size="sm" variant="secondary">
            New page
          </Button>
        ),
      },
      {
        title: 'Star what you use',
        description: 'Starred pages stay one click away on this page.',
      },
    ],
  },
} satisfies Meta<typeof StartGuide>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FirstRun: Story = {};

export const SecondStep: Story = {
  args: {
    steps: [
      { title: 'Create a space', description: 'Engineering is ready.', done: true },
      {
        title: 'Write the first page',
        description: 'Start blank or from a template.',
        action: <Button size="sm">New page</Button>,
      },
      { title: 'Star what you use', description: 'Starred pages stay one click away.' },
    ],
  },
};
