import { InsightActions, insightPoints, useAiInsight } from '@bemmoly/core-web/ai-insights';
import { navigateInApp } from '@bemmoly/core-web';
import { AiActionButton, AiInsightBar, AiInsightBody } from '@bemmoly/ui';
import { useState } from 'react';
import { useAiEnabled } from '../issue/issue-ai-summary.tsx';
import { api } from './api.ts';
import { cx } from '../issue/cx.ts';

const TITLES = {
  on_track: 'Sprint on track',
  at_risk: 'Sprint risk',
  off_track: 'Sprint off track',
} as const;

/**
 * The sprint pulse (tech design 11.5) over the Board and Backlog of a running sprint: one
 * line naming the biggest risk with its numbers, each linked to its source. It refreshes in
 * the background five quiet minutes after the sprint changes; Dismiss hides it until the
 * screen is opened again. Nothing is drawn while AI is off.
 */
export function SprintPulse({
  sprintId,
  className,
}: {
  sprintId: string | null | undefined;
  className?: string;
}) {
  const aiEnabled = useAiEnabled();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const handle = useAiInsight({
    http: api.http,
    kind: 'sprint_pulse',
    targetId: sprintId,
    aiEnabled,
  });
  if (handle.view === 'hidden' || !sprintId || dismissed === sprintId) return null;
  const insight = handle.insight;
  const risk = insight?.kind === 'sprint_pulse' ? insight.content?.output.risk : undefined;
  return (
    <div className={cx('shrink-0', className)}>
      <AiInsightBar
        title={risk ? TITLES[risk] : 'Sprint risk'}
        onDismiss={() => setDismissed(sprintId)}
        actions={
          handle.view === 'failed' ? (
            <AiActionButton onClick={handle.retry}>Try again</AiActionButton>
          ) : (
            <InsightActions handle={handle} />
          )
        }
      >
        <AiInsightBody
          inline
          state={handle.view}
          points={insightPoints(insight)}
          citations={insight?.content?.citations ?? []}
          failedLabel="Couldn’t get the sprint risk"
          onNavigate={navigateInApp}
        />
      </AiInsightBar>
    </div>
  );
}
