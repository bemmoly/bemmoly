import { InsightActions, useAiInsight } from '@bemmoly/core-web/ai-insights';
import { navigateInApp } from '@bemmoly/core-web';
import { AiSummary } from '@bemmoly/ui';
import { AiInsightBody } from '@bemmoly/ui/ai-insight-body';
import { api } from '../shared/api.ts';
import { useSession } from '../shared/people.ts';

/**
 * The page's consistency check beside its linked work: each place the page says something an
 * issue it names contradicts, with both linked and how sure the check is. Checks run when the
 * page is published and when a linked issue changes; with none found, or AI off, it is not
 * drawn.
 */
export function ConsistencyFindings({ pageId }: { pageId: string }) {
  const { aiEnabled } = useSession();
  const handle = useAiInsight({ http: api.http, kind: 'consistency', targetId: pageId, aiEnabled });
  const insight = handle.insight?.kind === 'consistency' ? handle.insight : undefined;
  const findings = insight?.content?.output.findings ?? [];
  if (handle.view === 'hidden' || (handle.view === 'ready' && findings.length === 0)) return null;
  return (
    <AiSummary
      title="Doesn’t match its issues"
      source={handle.view === 'ready' ? `by AI · ${findings.length} found` : 'by AI'}
      actions={handle.view === 'ready' ? <InsightActions handle={handle} /> : undefined}
    >
      {handle.view === 'ready' ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {findings.map((finding, index) => (
            <li key={index} className="flex flex-col gap-0.5">
              <AiInsightBody
                state="ready"
                points={[
                  {
                    text: `“${finding.claim}” ${finding.issueKey} says ${finding.issueValue}`,
                    cites: finding.cites,
                  },
                ]}
                citations={insight?.content?.citations ?? []}
                onNavigate={navigateInApp}
              />
              <span className="text-12 text-tx-3">
                {finding.location.heading ?? 'Introduction'} · {finding.field} ·{' '}
                {Math.round(finding.confidence * 100)}% sure
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <AiInsightBody
          state={handle.view}
          failedLabel="Couldn’t check the page"
          failedDetail={handle.failedDetail}
          onRetry={handle.retry}
          lines={2}
        />
      )}
    </AiSummary>
  );
}
