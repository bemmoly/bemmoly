import { navigateInApp } from '@bemmoly/core-web';
import {
  InsightActions,
  insightPoints,
  insightSource,
  useAiInsight,
} from '@bemmoly/core-web/ai-insights';
import { AiBrief, Skeleton } from '@bemmoly/ui';
import { AiInsightBody } from '@bemmoly/ui/ai-insight-body';
import { api } from '../../lib/api.ts';

/**
 * Home's morning brief (tech design 11.3 and 11.5): what changed in the person's projects
 * and spaces since their last visit, theirs first, each claim linked to the issue, page or
 * sprint it rests on, with a step or two to take. Written by a job at their local 6 a.m.
 * and kept for the day. Loaded as its own chunk, only while AI is on; a day with nothing to
 * say draws nothing.
 */
export default function MorningBrief({ userId }: { userId: string }) {
  const handle = useAiInsight({
    http: api.http,
    kind: 'morning_brief',
    targetId: userId,
    aiEnabled: true,
  });
  const points = insightPoints(handle.insight);
  if (handle.view === 'hidden' || (handle.view === 'ready' && points.length === 0)) return null;
  return (
    <AiBrief
      title="Your morning brief"
      source={insightSource(handle).replace('from', 'built from')}
      actions={
        handle.view === 'ready' ? (
          <InsightActions handle={handle} size="md" />
        ) : handle.view === 'loading' ? (
          // Holds the action row's height so Home does not jump when the brief lands.
          <Skeleton shape="block" width={320} height={30} />
        ) : undefined
      }
    >
      <AiInsightBody
        state={handle.view}
        points={points}
        citations={handle.insight?.content?.citations ?? []}
        failedLabel="Couldn’t get your brief"
        failedDetail={handle.failedDetail}
        onRetry={handle.retry}
        onNavigate={navigateInApp}
        lines={2}
      />
    </AiBrief>
  );
}
