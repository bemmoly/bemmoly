import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../button/button.tsx';
import { AiBrief, AiInsightBar, AiSuggestion, AiSummary } from './ai-cards.tsx';
import { AiActionButton, AiAskButton, AiNotUseful } from './ai-parts.tsx';

const meta = { title: 'Components/AI surfaces', component: AiSummary } satisfies Meta<
  typeof AiSummary
>;

export default meta;

type Story = StoryObj<typeof meta>;

const noop = () => {};

export const Summary: Story = {
  args: { children: null },
  parameters: {
    mock: [
      { file: 'Bemmoly Board.dc.html', x: 1056, y: 200, w: 380, h: 180, note: 'drawer (panel)' },
      { file: 'Bemmoly Issue.dc.html', x: 250, y: 180, w: 820, h: 170, note: 'issue page (page)' },
    ],
  },
  render: () => (
    <div className="flex w-90 flex-col gap-4">
      <AiSummary
        source="from 14 comments, 2 PRs"
        actions={
          <>
            <AiActionButton>Ping Jonas about #4821</AiActionButton>
            <AiNotUseful />
          </>
        }
      >
        Backfill verified on staging with zero mismatches. The only open item is review of PR #4821,
        waiting on Jonas since Thursday.
      </AiSummary>
      <AiSummary
        variant="page"
        source="from 14 comments, 2 PRs, 1 doc"
        actions={
          <>
            <AiActionButton size="md">Fix RFC inconsistency</AiActionButton>
            <AiNotUseful size="md" />
          </>
        }
      >
        The RFC&apos;s rollback section still disagrees with the flag TTL (15 vs 30 min).
      </AiSummary>
    </div>
  ),
};

export const InsightBar: Story = {
  args: { children: null },
  parameters: {
    mock: [{ file: 'Bemmoly Board.dc.html', x: 256, y: 168, w: 768, h: 60, note: 'sprint risk' }],
  },
  render: () => (
    <div className="w-188 bg-sunken p-1">
      <AiInsightBar
        title="Sprint risk"
        onDismiss={noop}
        actions={
          <>
            <Button size="xs">Nudge reviewer</Button>
            <Button size="xs">Move blocked to Sprint 15</Button>
          </>
        }
      >
        PLT-204 has been in review 3 days and blocks 2 issues (5 pts). At current pace the sprint
        lands at 19/23 pts.
      </AiInsightBar>
    </div>
  ),
};

export const Brief: Story = {
  args: { children: null },
  parameters: {
    mock: [{ file: 'Bemmoly Home.dc.html', x: 112, y: 96, w: 1216, h: 140, note: 'morning brief' }],
  },
  render: () => (
    <div className="w-300">
      <AiBrief
        title="Your morning brief"
        source="built from 31 updates since Friday"
        actions={
          <>
            <AiActionButton size="md">Review PLT-204</AiActionButton>
            <Button size="xs">Open RFC comments</Button>
          </>
        }
      >
        Two things need you today. <b>PLT-204</b> is waiting on your review and is blocking two
        issues; Aisha verified the backfill on staging.
      </AiBrief>
    </div>
  ),
};

export const Suggestion: Story = {
  args: { children: null },
  parameters: {
    mock: [{ file: 'Bemmoly Backlog.dc.html', x: 525, y: 244, w: 890, h: 43, note: 'sprint tip' }],
  },
  render: () => (
    <div className="flex w-222 flex-col gap-3">
      <AiSuggestion onAccept={noop} acceptLabel="Apply" onDismiss={noop}>
        PLT-211 and PLT-219 are blocked by PLT-204 and unlikely to finish by Oct 7. Move both to
        Sprint 15 and the sprint lands at 18/18.
      </AiSuggestion>
      <AiSuggestion variant="card" onAccept={noop} onDismiss={noop} className="w-120">
        Code says 30 (auth/flags.go:41). Update the doc to 30 minutes?
      </AiSuggestion>
    </div>
  ),
};

export const AskButtons: Story = {
  args: { children: null },
  parameters: {
    mock: [
      { file: 'Bemmoly Board.dc.html', x: 1118, y: 4, w: 156, h: 40, note: 'top bar' },
      { file: 'Bemmoly Doc Editor.dc.html', x: 1300, y: 52, w: 92, h: 36, note: 'Copilot' },
    ],
  },
  render: () => (
    <div className="flex items-center gap-3">
      <AiAskButton shortcut="Mod+K" />
      <AiAskButton label="Copilot" size="sm" pressed />
    </div>
  ),
};
