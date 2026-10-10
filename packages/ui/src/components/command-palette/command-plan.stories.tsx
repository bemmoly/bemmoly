import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { CommandAiLine, CommandAiNotice, CommandAiThinking } from './command-ai.tsx';
import { CommandList } from './command-list.tsx';
import { CommandFooter, CommandInput, CommandPalette } from './command-palette.tsx';
import { CommandPlan, type CommandPlanState, type PlanStep } from './command-plan.tsx';

/*
 * Every state of the palette's AI: the AI line, thinking, a plan ready (and partly denied,
 * and being edited), running, done with Undo, a failed step, stopped, preview only (actions
 * off), the provider down, the budget spent and nothing to change.
 */

const meta = { title: 'Components/CommandPlan', component: CommandPlan } satisfies Meta<
  typeof CommandPlan
>;
export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};
const REQUEST = 'move everything blocked by PLT-204 to next sprint';

const move = (from: string, to: string) => (
  <span className="inline-flex items-center gap-1">
    {from} <Icon name="arrow" size={12} label="to" /> <b className="font-semibold">{to}</b>
  </span>
);

const STEPS: PlanStep[] = [
  {
    id: 0,
    target: 'PLT-211',
    change: 'Session cleanup background job',
    field: move('Sprint 14', 'Sprint 15'),
    allowed: true,
  },
  {
    id: 1,
    target: 'PLT-219',
    change: 'Remove legacy cookie path from monolith',
    field: move('Sprint 14', 'Sprint 15'),
    allowed: true,
  },
  {
    id: 2,
    target: 'both',
    change: 'Moved to Sprint 15: blocked by PLT-204 (in review). — via Bemmoly for Rohan',
    field: 'Comment',
    allowed: true,
  },
];

const SUMMARY = (
  <>
    Move the 2 issues blocked by <b>PLT-204</b> from Sprint 14 to Sprint 15, and post a note in each
    explaining why.
  </>
);

const withStatus = (statuses: PlanStep['status'][], errors: (string | null)[] = []) =>
  STEPS.map((step, i) => ({ ...step, status: statuses[i], error: errors[i] ?? null }));

function Frame({ children, query = REQUEST }: { children: React.ReactNode; query?: string }) {
  return (
    <CommandPalette open inline onClose={noop}>
      <CommandInput value={query} onValueChange={noop} ai />
      {children}
      <CommandFooter
        hints={[
          { keys: 'Enter', label: 'run' },
          { keys: 'Esc', label: 'close' },
        ]}
      />
    </CommandPalette>
  );
}

const plan = (state: CommandPlanState, steps: PlanStep[], extra = {}) => ({
  args: { summary: SUMMARY, steps, state, onRun: noop, onEdit: noop, ...extra },
  render: (args: React.ComponentProps<typeof CommandPlan>) => (
    <Frame>
      <CommandPlan {...args} />
    </Frame>
  ),
});

export const AiLine: Story = {
  args: { summary: '', steps: [] },
  render: () => (
    <Frame query="what changed in auth this week">
      <CommandList>
        <CommandAiLine label="Ask Bemmoly" query="what changed in auth this week" onSelect={noop} />
      </CommandList>
    </Frame>
  ),
};

export const Thinking: Story = {
  args: { summary: '', steps: [] },
  render: () => (
    <Frame>
      <CommandAiThinking onCancel={noop} />
    </Frame>
  ),
};

export const Ready: Story = { ...plan('ready', STEPS, { onNotUseful: noop }) };

export const PartiallyDenied: Story = {
  ...plan('ready', [
    ...STEPS.slice(0, 2),
    {
      id: 3,
      target: 'OPS-12',
      change: 'Rotate the on-call pager',
      field: move('Backlog', 'Sprint 15'),
      allowed: false,
      reason: 'You are not a member of Operations.',
    },
  ]),
};

function EditingPlan() {
  const [kept, setKept] = useState(new Set<string | number>([0, 2]));
  const toggle = (id: string | number) =>
    setKept((now) => {
      const next = new Set(now);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <Frame>
      <CommandPlan
        summary={SUMMARY}
        steps={STEPS}
        editing
        kept={kept}
        onToggle={toggle}
        onRun={noop}
        onEdit={noop}
      />
    </Frame>
  );
}

export const Editing: Story = { args: { summary: '', steps: [] }, render: () => <EditingPlan /> };

export const Running: Story = {
  ...plan('running', withStatus(['done', 'running', 'pending']), { onStop: noop }),
};

export const Done: Story = {
  ...plan('done', withStatus(['done', 'done', 'done']), { onUndo: noop, onNotUseful: noop }),
};

export const FailedStep: Story = {
  ...plan(
    'failed',
    withStatus(['done', 'failed', 'done'], [null, 'PLT-219 was moved to Done by Lena; check it.']),
    { onUndo: noop },
  ),
};

export const Stopped: Story = {
  ...plan('cancelled', withStatus(['done', 'skipped', 'skipped']), { onUndo: noop }),
};

export const PreviewOnly: Story = {
  ...plan('preview', STEPS, {
    onRun: undefined,
    onEdit: undefined,
    footnote: 'An admin can turn AI actions on in Settings › AI.',
  }),
};

export const ProviderDown: Story = {
  args: { summary: '', steps: [] },
  render: () => (
    <Frame>
      <CommandAiNotice
        tone="problem"
        title="The AI provider didn't answer"
        action={{ label: 'Try again', onClick: noop }}
      >
        House models returned a rate limit. Try again in 30 seconds; search still works.
      </CommandAiNotice>
    </Frame>
  ),
};

export const BudgetReached: Story = {
  args: { summary: '', steps: [] },
  render: () => (
    <Frame>
      <CommandAiNotice tone="problem" title="This month's AI budget is spent">
        Plans and answers resume on the 1st. Search and every other command still work.
      </CommandAiNotice>
    </Frame>
  ),
};

export const NothingToChange: Story = {
  ...plan('ready', [], {
    summary: 'Nothing is blocked by PLT-204, so there is nothing to move.',
    onRun: undefined,
    onEdit: undefined,
  }),
};
