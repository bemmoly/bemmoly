import type { Meta, StoryObj } from '@storybook/react-vite';
import { Icon } from '../../icons/icon.tsx';
import { Kbd } from '../kbd/kbd.tsx';
import { useState } from 'react';
import { Button } from '../button/button.tsx';
import { TypeGlyph } from '../glyphs/glyphs.tsx';
import { CommandGlyph, CommandGroup, CommandItem, CommandList } from './command-list.tsx';
import { CommandFooter, CommandInput, CommandPalette, CommandScopes } from './command-palette.tsx';
import { CommandPlan } from './command-plan.tsx';

const meta = { title: 'Components/CommandPalette', component: CommandPalette } satisfies Meta<
  typeof CommandPalette
>;

export default meta;

type Story = StoryObj<typeof meta>;

const noop = () => {};
const SCOPES = [
  { value: 'all', label: 'All' },
  { value: 'issues', label: 'Issues' },
  { value: 'docs', label: 'Docs' },
  { value: 'people', label: 'People' },
  { value: 'actions', label: 'Actions' },
] as const;
type Scope = (typeof SCOPES)[number]['value'];

const Try = () => (
  <>
    Try: <span className="text-acc">&quot;issues without a spec doc&quot;</span> ·{' '}
    <span className="text-acc">&quot;what changed in auth this week&quot;</span>
  </>
);

function Palette({ plan, inline }: { plan: boolean; inline: boolean }) {
  const [q, setQ] = useState(plan ? 'move everything blocked by PLT-204 to next sprint' : 'auth');
  const [scope, setScope] = useState<Scope>('all');
  const [open, setOpen] = useState(true);
  if (!open)
    return (
      <Button onClick={() => setOpen(true)}>
        Open <Kbd keys="Mod+K" variant="plain" />
      </Button>
    );
  return (
    <CommandPalette open inline={inline} onClose={() => setOpen(false)}>
      <CommandInput value={q} onValueChange={setQ} />
      <CommandScopes
        scopes={SCOPES}
        value={scope}
        onChange={setScope}
        context={
          <>
            in Platform Core · <span className="text-acc">everywhere</span>
          </>
        }
      />
      {plan ? (
        <CommandPlan
          summary={
            <>
              Move the 2 issues blocked by <b>PLT-204</b> from Sprint 14 to Sprint 15, and post a
              note in each explaining why.
            </>
          }
          steps={[
            {
              target: 'PLT-211',
              change: 'Session cleanup background job',
              field: (
                <span className="inline-flex items-center gap-1">
                  Sprint 14 <Icon name="arrow" size={12} label="to" /> <b>Sprint 15</b>
                </span>
              ),
              allowed: true,
            },
            {
              target: 'PLT-219',
              change: 'Remove legacy cookie path from monolith',
              field: (
                <span className="inline-flex items-center gap-1">
                  Sprint 14 <Icon name="arrow" size={12} label="to" /> <b>Sprint 15</b>
                </span>
              ),
              allowed: true,
            },
            {
              target: 'both',
              change: (
                <span className="text-tx-2">
                  Comment: &quot;Moved to Sprint 15: blocked by PLT-204 (in review). — via Bemmoly
                  for Rohan&quot;
                </span>
              ),
              field: 'Comment',
              allowed: true,
            },
          ]}
          onRun={noop}
          onEdit={noop}
        />
      ) : (
        <CommandList>
          <CommandGroup label="Issues">
            <CommandItem
              icon={<TypeGlyph type="story" size={16} />}
              issueKey="PLT-204"
              title="Session store migration to Postgres"
              meta="In review · Aisha"
              onSelect={noop}
            />
            <CommandItem
              icon={<TypeGlyph type="bug" size={16} />}
              issueKey="PLT-226"
              title="Refresh token reused after logout on Safari"
              meta="In progress · Lena"
              onSelect={noop}
            />
          </CommandGroup>
          <CommandGroup label="Docs">
            <CommandItem
              icon={<CommandGlyph icon="doc" />}
              title="Auth service RFC"
              meta="Engineering · edited 2h ago"
              onSelect={noop}
            />
          </CommandGroup>
          <CommandGroup label="Actions">
            <CommandItem
              icon={<CommandGlyph icon="spark" tone="ai" round />}
              title="Ask: what changed in auth this week?"
              meta="AI answer with citations"
              onSelect={noop}
            />
            <CommandItem
              icon={<CommandGlyph icon="plus" tone="accent" />}
              title="Create issue in Platform Core"
              meta={<Kbd keys="Mod+N" />}
              onSelect={noop}
            />
          </CommandGroup>
        </CommandList>
      )}
      <CommandFooter extra={<Try />} />
    </CommandPalette>
  );
}

export const Plan: Story = {
  args: { open: true, onClose: noop, children: null },
  parameters: {
    mock: [{ file: 'Bemmoly Command.dc.html', x: 340, y: 96, w: 760, h: 420, note: 'plan' }],
  },
  render: () => <Palette plan inline />,
};

export const Search: Story = {
  args: { open: true, onClose: noop, children: null },
  render: () => <Palette plan={false} inline />,
};

export const AsModal: Story = {
  args: { open: true, onClose: noop, children: null },
  parameters: { layout: 'fullscreen', mock: undefined },
  render: () => (
    <div className="h-200 bg-sunken p-6">
      <Palette plan={false} inline={false} />
    </div>
  ),
};
