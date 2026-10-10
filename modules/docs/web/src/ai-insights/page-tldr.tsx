import { AiInsightCard, useAiInsight } from '@bemmoly/core-web/ai-insights';
import { api } from '../shared/api.ts';
import { useSession } from '../shared/people.ts';

/**
 * The page's TL;DR (tech design 11.3) under its heading: what the page decides, how it is
 * undone and what is still open, each claim linked to its section. It is rewritten only when
 * the page text changes, and draws nothing while AI is off or for a page with no text yet.
 */
export function PageTldr({ pageId }: { pageId: string }) {
  const { aiEnabled } = useSession();
  const handle = useAiInsight({ http: api.http, kind: 'page_tldr', targetId: pageId, aiEnabled });
  return (
    <AiInsightCard handle={handle} title="TL;DR" failedLabel="Couldn’t get a TL;DR" lines={2} />
  );
}
