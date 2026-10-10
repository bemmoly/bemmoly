import { AiSummary } from '@bemmoly/ui';
import { useSession } from '../../shared/people.ts';
import { usePageScreen } from '../screen-context.ts';
import { PageIdentity } from './page-identity.tsx';
import { PageTitle } from './page-title.tsx';
import { PropertiesRow } from './properties-row.tsx';

/** "Sep 12", with the year when it is not this one: "Sep 12, 2025". */
export function shortDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}

/**
 * Everything above the body, as the review draws the page column: the icon (with Add icon
 * and Add cover on hover while either is missing), the 36px title, the one properties row
 * and a hairline. When the page has one and the workspace has AI on, its generated TL;DR
 * follows in the AI lilac; with AI off a stored summary stays unshown.
 */
export function PageHeading() {
  const { page } = usePageScreen();
  const { aiEnabled } = useSession();
  return (
    <header className="group/heading flex flex-col">
      <PageIdentity />
      <div className="mt-4">
        <PageTitle />
      </div>
      <PropertiesRow />
      <div aria-hidden className="mt-3.5 mb-1.5 h-px bg-line" />
      {aiEnabled && page.tldr && (
        <AiSummary variant="page" title="TL;DR" source="generated · updates with the doc">
          {page.tldr}
        </AiSummary>
      )}
    </header>
  );
}
