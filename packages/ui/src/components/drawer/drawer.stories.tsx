import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { AiActionButton, AiNotUseful } from '../ai-surface/ai-parts.tsx';
import { AiSummary } from '../ai-surface/ai-cards.tsx';
import { Button } from '../button/button.tsx';
import { IconButton } from '../button/icon-button.tsx';
import { TypeGlyph } from '../glyphs/glyphs.tsx';
import { KeyChip } from '../key-chip/key-chip.tsx';
import { StatusButton } from '../status-badge/status-badge.tsx';
import { Drawer, DrawerTitle } from './drawer.tsx';

const meta = { title: 'Components/Drawer', component: Drawer } satisfies Meta<typeof Drawer>;

export default meta;

type Story = StoryObj<typeof meta>;

function IssuePanel({ variant }: { variant: 'docked' | 'overlay' }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex h-130 bg-sunken">
      <div className="flex flex-1 items-start p-4">
        {!open && <Button onClick={() => setOpen(true)}>Open PLT-204</Button>}
      </div>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        variant={variant}
        label="PLT-204 details"
        header={
          <>
            <span className="size-2.5 rounded-chip bg-acc" />
            <span>Auth service</span>
            <span>/</span>
            <TypeGlyph type="story" />
            <KeyChip issueKey="PLT-204" size="md" />
          </>
        }
        actions={
          <>
            <IconButton label="Open full page" icon="expand" size="xs" />
            <IconButton label="More" icon="more" size="xs" />
          </>
        }
      >
        <DrawerTitle>Session store migration to Postgres</DrawerTitle>
        <div className="flex flex-wrap gap-1.5">
          <StatusButton category="review" />
          <Button size="sm">Attach</Button>
          <Button size="sm">Link doc</Button>
          <Button size="sm">Subtask</Button>
        </div>
        <AiSummary
          source="from 14 comments, 2 PRs"
          actions={
            <>
              <AiActionButton>Ping Jonas about #4821</AiActionButton>
              <AiNotUseful />
            </>
          }
        >
          Backfill verified on staging with zero mismatches. The only open item is review of PR
          #4821, waiting on Jonas since Thursday. Two downstream issues (PLT-211, PLT-219) are
          blocked on this merge.
        </AiSummary>
      </Drawer>
    </div>
  );
}

export const Docked: Story = {
  args: { open: true, onClose: () => {}, label: 'Issue', children: null },
  parameters: {
    layout: 'fullscreen',
    mock: [{ file: 'Bemmoly Board.dc.html', x: 1040, y: 48, w: 400, h: 340, note: 'issue panel' }],
  },
  render: () => <IssuePanel variant="docked" />,
};

export const Overlay: Story = {
  args: { open: true, onClose: () => {}, label: 'Issue', children: null },
  parameters: { layout: 'fullscreen', mock: undefined },
  render: () => <IssuePanel variant="overlay" />,
};
