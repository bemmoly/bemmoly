import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { EpicItem, EpicPanel } from './epic-panel.tsx';

const meta = {
  title: 'Components/EpicPanel',
  component: EpicItem,
  args: {
    name: 'Auth service',
    epicKey: 'PLT-180',
    colorClassName: 'bg-ac',
    progress: 61,
    meta: '9 issues · due Oct 7',
  },
} satisfies Meta<typeof EpicItem>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

const EPICS = [
  { key: 'PLT-180', name: 'Auth service', color: 'bg-ac', pct: 61, meta: '9 issues · due Oct 7' },
  {
    key: 'PLT-150',
    name: 'Billing v2',
    color: 'bg-epic-2',
    pct: 34,
    meta: '12 issues · due Oct 21',
  },
  {
    key: 'PLT-240',
    name: 'Observability',
    color: 'bg-sky-fg',
    pct: 0,
    meta: '6 issues · not started',
  },
  {
    key: 'PLT-160',
    name: 'Self-serve onboarding',
    color: 'bg-orange-fg',
    pct: 85,
    meta: '8 issues · due Oct 10',
  },
];

/** The Backlog's epics panel with one epic picked as the filter. */
export const Panel: Story = {
  parameters: {
    layout: 'fullscreen',
    mock: [{ file: 'Bemmoly Backlog.dc.html', x: 240, y: 186, w: 260, h: 330, note: 'epics' }],
  },
  render: function Render() {
    const [picked, setPicked] = useState<string | null>('PLT-150');
    return (
      <div className="flex h-82.5 bg-bg">
        <EpicPanel onCreate={() => {}}>
          {EPICS.map((epic) => (
            <EpicItem
              key={epic.key}
              name={epic.name}
              epicKey={epic.key}
              colorClassName={epic.color}
              progress={epic.pct}
              meta={epic.meta}
              selected={picked === epic.key}
              onSelect={() => setPicked((p) => (p === epic.key ? null : epic.key))}
            />
          ))}
        </EpicPanel>
      </div>
    );
  },
};
