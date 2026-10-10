import {
  describeAiSource,
  type AiCitedPoint,
  type AiInsight,
  type AiInsightKind,
  type AiNextStep,
} from '@bemmoly/shared/ai-insights';
import { AiActionButton, AiInsightBody, AiNotUseful, AiSummary } from '@bemmoly/ui';
import type { ReactNode } from 'react';
import { navigateInApp } from '../modules/navigation.ts';
import type { AiInsightHandle } from './use-ai-insight.ts';

/** The claims an insight makes, whatever its kind, for AiInsightBody. */
export function insightPoints(insight: AiInsight | undefined): AiCitedPoint[] {
  const content = insight?.content;
  if (!insight || !content) return [];
  switch (insight.kind) {
    case 'sprint_pulse':
      return insight.content ? [insight.content.output.headline] : [];
    case 'consistency':
      return (insight.content?.output.findings ?? []).map((finding) => ({
        text: `“${finding.claim}” disagrees with ${finding.issueKey} (${finding.field}: ${finding.issueValue}).`,
        cites: finding.cites,
      }));
    case 'issue_summary':
    case 'page_tldr':
    case 'morning_brief':
      return insight.content?.output.points ?? [];
  }
}

/** The steps an insight proposes; each opens the source it names. */
export function insightSteps(insight: AiInsight | undefined): AiNextStep[] {
  if (!insight?.content || insight.kind === 'page_tldr' || insight.kind === 'consistency') {
    return [];
  }
  return insight.content.output.next;
}

/** "by AI · from 14 comments, 2 PRs" (and "updating" while a newer one is written). */
export function insightSource<K extends AiInsightKind>(handle: AiInsightHandle<K>): string {
  if (handle.view !== 'ready' || !handle.insight?.content) return 'by AI';
  const read = describeAiSource(handle.insight.content.source.counts);
  return ['by AI', read && `from ${read}`, handle.refreshing && 'updating']
    .filter(Boolean)
    .join(' · ');
}

const hrefOf = (insight: AiInsight | undefined, cite: string) =>
  insight?.content?.citations.find((citation) => citation.id === cite)?.href ?? null;

/** The proposed steps and Not useful: the actions every insight card carries. */
export function InsightActions<K extends AiInsightKind>({
  handle,
  size = 'sm',
}: {
  handle: AiInsightHandle<K>;
  size?: 'sm' | 'md';
}) {
  if (handle.view !== 'ready') return null;
  const marked = handle.insight?.feedback === 'not_useful';
  return (
    <>
      {insightSteps(handle.insight).map((step) => {
        const href = hrefOf(handle.insight, step.cite);
        return href ? (
          <AiActionButton
            key={step.cite + step.label}
            size={size}
            onClick={() => navigateInApp(href)}
          >
            {step.label}
          </AiActionButton>
        ) : null;
      })}
      <AiNotUseful
        size={size}
        disabled={marked}
        aria-pressed={marked}
        onClick={() => handle.markNotUseful()}
      >
        {marked ? 'Marked not useful' : 'Not useful'}
      </AiNotUseful>
    </>
  );
}

/**
 * An AiSummary for one insight: skeleton while it is written, "Couldn't get a …" with Try
 * again when it failed, cited claims with an Unsourced mark otherwise. Draws nothing while
 * the insight is hidden (AI off, refused, gone).
 */
export function AiInsightCard<K extends AiInsightKind>({
  handle,
  title,
  failedLabel,
  variant = 'page',
  lines = 3,
  className,
}: {
  handle: AiInsightHandle<K>;
  title: ReactNode;
  failedLabel: string;
  variant?: 'page' | 'panel';
  lines?: number;
  className?: string;
}) {
  if (handle.view === 'hidden') return null;
  return (
    <AiSummary
      variant={variant}
      title={title}
      source={insightSource(handle)}
      actions={
        handle.view === 'ready' ? (
          <InsightActions handle={handle} size={variant === 'page' ? 'md' : 'sm'} />
        ) : undefined
      }
      {...(className ? { className } : {})}
    >
      <AiInsightBody
        state={handle.view}
        points={insightPoints(handle.insight)}
        citations={handle.insight?.content?.citations ?? []}
        failedLabel={failedLabel}
        failedDetail={handle.failedDetail}
        onRetry={handle.retry}
        onNavigate={navigateInApp}
        lines={lines}
      />
    </AiSummary>
  );
}
