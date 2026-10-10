import { formatRelative } from '@bemmoly/core-web';
import type { AttentionItem as Attention, TemplateSummary } from '@bemmoly/module-docs/shared';
import { AttentionItem, AttentionList, Card, CardHeader, TemplateChip } from '@bemmoly/ui';
import { useAttention } from '../hooks/home-queries.ts';
import { docsPaths } from '../shared/navigation.ts';
import type { DocsPersonView } from '../shared/people.ts';

/** "14 months ago" from a timestamp, for "last edited …" in a sentence. */
const ago = (iso: string) => formatRelative(iso).toLowerCase();

function Line({
  item,
  person,
}: {
  item: Attention;
  person: (id: string | null) => DocsPersonView | null;
}) {
  const link = <a href={docsPaths.page(item.page.id)}>{item.page.title || 'Untitled'}</a>;
  if (item.kind === 'review') {
    const owner = person(item.page.ownerId);
    return (
      <AttentionItem
        tone="warn"
        meta={`${owner ? `${owner.name}, ` : ''}waiting since ${ago(item.since)}`}
      >
        <b>Review requested</b> on {link}
      </AttentionItem>
    );
  }
  return (
    <AttentionItem tone="caution" meta="You own it. Check it still holds, or archive it.">
      <b>Stale:</b> {link} last edited {ago(item.since)}
    </AttentionItem>
  );
}

/**
 * "Needs attention" from the Docs mock, filled from the pages: reviews the person was asked
 * for and stale pages they own. With nothing waiting it is not drawn at all; the comment
 * and AI-found conflicts of the mock join when those features land.
 */
export function AttentionPanel({
  person,
}: {
  person: (id: string | null) => DocsPersonView | null;
}) {
  const attention = useAttention();
  const items = attention.data?.items ?? [];
  if (items.length === 0) return null;
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Needs attention" />
      <AttentionList label="Needs attention">
        {items.map((item) => (
          <Line key={`${item.kind}:${item.page.id}`} item={item} person={person} />
        ))}
      </AttentionList>
    </Card>
  );
}

/**
 * The Templates panel: the first six templates as chips, two to a row; a chip opens the
 * new-page picker with that template chosen.
 */
export function TemplatesPanel({
  templates,
  onPick,
}: {
  templates: readonly TemplateSummary[];
  onPick: (templateId: string) => void;
}) {
  if (templates.length === 0) return null;
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Templates" />
      <div className="grid grid-cols-2 gap-1.5 px-4 py-2.5">
        {templates.slice(0, 6).map((template) => (
          <TemplateChip key={template.id} onClick={() => onPick(template.id)}>
            {template.name}
          </TemplateChip>
        ))}
      </div>
    </Card>
  );
}
