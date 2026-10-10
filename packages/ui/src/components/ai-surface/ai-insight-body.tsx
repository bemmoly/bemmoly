import { Fragment, type MouseEvent } from 'react';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';
import { Skeleton, SkeletonText } from '../skeleton/skeleton.tsx';
import { Tag } from '../tag/tag.tsx';
import { AiActionButton } from './ai-parts.tsx';

export interface AiCitedPoint {
  text: string;
  /** Citation ids ("c3"); empty means the claim has no source. */
  cites: readonly string[];
}

export interface AiCitationLink {
  id: string;
  /** How the link reads: "PLT-204", "Jonas M.'s comment", "Rollback". */
  label: string;
  /** Where inside the object, shown on hover: a heading, a field, a date. */
  location?: string | null;
  href: string | null;
}

export interface AiInsightBodyProps {
  /** loading: a skeleton. failed: "Couldn't get a summary" with Try again. ready: the points. */
  state: 'loading' | 'failed' | 'ready';
  points?: readonly AiCitedPoint[];
  citations?: readonly AiCitationLink[];
  /** "Couldn't get a summary", "Couldn't get a TL;DR". */
  failedLabel?: string;
  /** The honest reason, when there is one: "Rate limited; try again in 30 seconds". */
  failedDetail?: string | null;
  onRetry?: () => void;
  /** Skeleton lines while loading. */
  lines?: number;
  /**
   * One line inside an AiInsightBar: spans instead of blocks, one skeleton bar, and the failed
   * label alone (the bar's own actions carry Try again).
   */
  inline?: boolean;
  /** In-app navigation for a citation link; without it the link is a plain anchor. */
  onNavigate?: (href: string) => void;
  className?: string;
}

/** The same chip as AiAnswer's numbered citations, carrying the source's name instead. */
const CHIP = cx(
  'ml-0.5 inline-flex items-center rounded-chip border border-ai-100 bg-card px-1 align-baseline text-11 font-medium whitespace-nowrap text-ai-600 no-underline hover:bg-ai-50',
  focusRing,
);

function CitationLink({
  citation,
  onNavigate,
}: {
  citation: AiCitationLink;
  onNavigate: ((href: string) => void) | undefined;
}) {
  const { href } = citation;
  if (!href) return <span className={CHIP}>{citation.label}</span>;
  const follow = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!onNavigate || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    onNavigate(href);
  };
  return (
    <a href={href} className={CHIP} title={citation.location ?? undefined} onClick={follow}>
      {citation.label}
    </a>
  );
}

/**
 * The body of an AI card: what the model wrote, each claim followed by links to its sources
 * and, when it has none, a visible "Unsourced" mark rather than hiding it (tech design 11.3).
 * Owns the card's loading and failed states so every AI card reads the same.
 */
export function AiInsightBody({
  state,
  points = [],
  citations = [],
  failedLabel = 'Couldn’t get a summary',
  failedDetail,
  onRetry,
  lines = 3,
  onNavigate,
  inline = false,
  className,
}: AiInsightBodyProps) {
  if (inline && state !== 'ready') {
    return state === 'loading' ? (
      <span role="status" aria-busy="true" aria-label="Writing with AI" className={className}>
        <Skeleton width={240} className="inline-block align-middle" />
      </span>
    ) : (
      <span role="status" className={className}>
        {failedLabel}
      </span>
    );
  }
  if (state === 'loading') {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Writing with AI"
        className={cx('py-0.5', className)}
      >
        <SkeletonText lines={lines} />
      </div>
    );
  }
  if (state === 'failed') {
    return (
      <div role="status" className={cx('flex flex-wrap items-center gap-2 text-tx-2', className)}>
        <span>{failedLabel}</span>
        {onRetry && (
          <AiActionButton size="sm" onClick={onRetry}>
            Try again
          </AiActionButton>
        )}
        {failedDetail && <span className="w-full text-12 text-tx-3">{failedDetail}</span>}
      </div>
    );
  }
  const byId = new Map(citations.map((citation) => [citation.id, citation]));
  const Text = inline ? 'span' : 'p';
  return (
    <Text className={cx('m-0', className)}>
      {points.map((point, index) => {
        const sources = point.cites.flatMap((id) => byId.get(id) ?? []);
        return (
          <Fragment key={index}>
            {index > 0 && ' '}
            <span>{point.text}</span>
            {sources.map((citation) => (
              <Fragment key={citation.id}>
                {' '}
                <CitationLink citation={citation} onNavigate={onNavigate} />
              </Fragment>
            ))}
            {sources.length === 0 && (
              <>
                {' '}
                <Tag className="align-baseline" title="No source in your workspace backs this">
                  Unsourced
                </Tag>
              </>
            )}
          </Fragment>
        );
      })}
    </Text>
  );
}
