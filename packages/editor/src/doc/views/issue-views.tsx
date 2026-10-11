import { Button, Input } from '@bemmoly/ui';
import { useState, type FormEvent } from 'react';
import { cx } from '../../cx.ts';
import { useDocServices } from '../context.ts';
import type { NodeViewProps, ViewSpec } from '../portals.ts';
import type { IssueTableAttrs } from '../services.ts';
import { ISSUE_CHIP, ISSUE_CHIP_SQUARE, PLACEHOLDER_CARD, PLACEHOLDER_TITLE } from '../styles.ts';

/*
 * Issues in a page are drawn by the host (Work, when it is on). With no renderer, an embed
 * prints its key as the mock's chip with a neutral square, and an issue table a dashed card
 * with its query, so a page written with Work on still reads with Work off.
 */

/** An issue chip: the host's live one, or the key alone. */
export function IssueChip({ issueKey }: { issueKey: string }) {
  const { renderIssue } = useDocServices();
  if (renderIssue) return <>{renderIssue(issueKey)}</>;
  return (
    <span className={ISSUE_CHIP} title={`${issueKey} (issue details unavailable)`}>
      <span aria-hidden className={ISSUE_CHIP_SQUARE} />
      {issueKey}
    </span>
  );
}

/** The card an issue table shows when nothing can draw it live. */
export function IssueTablePlaceholder({ query, title }: IssueTableAttrs) {
  return (
    <div className={PLACEHOLDER_CARD}>
      <span className={PLACEHOLDER_TITLE}>{title || 'Issue table'}</span>
      {query ? (
        <code className="self-start rounded-chip bg-line-2 px-1.25 py-px font-mono text-12">
          {query}
        </code>
      ) : (
        <span>No filter yet.</span>
      )}
      <span className="text-12 text-tx-3">Live issues appear here when Work is enabled.</span>
    </div>
  );
}

/** An issue table: the host's live one, or the placeholder. */
export function IssueTableBlock(attrs: IssueTableAttrs) {
  const { renderIssueTable } = useDocServices();
  if (renderIssueTable && attrs.query) return <>{renderIssueTable(attrs)}</>;
  return <IssueTablePlaceholder {...attrs} />;
}

/** Where a new issue table asks for its filter, as LQL. */
function FilterForm({
  initial,
  onSave,
}: {
  initial: IssueTableAttrs;
  onSave: (attrs: IssueTableAttrs) => void;
}) {
  const [query, setQuery] = useState(initial.query);
  const [title, setTitle] = useState(initial.title);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (query.trim()) onSave({ query: query.trim(), title: title.trim() });
  };
  return (
    <form onSubmit={submit} className={cx(PLACEHOLDER_CARD, 'gap-2')}>
      <span className={PLACEHOLDER_TITLE}>Issue table from filter</span>
      <Input
        aria-label="Filter"
        placeholder="project = PLT AND status != Done"
        value={query}
        autoFocus
        mono
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="flex items-center gap-2">
        <Input
          aria-label="Table title"
          placeholder="Title (optional)"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          wrapperClassName="min-w-0 flex-1"
        />
        <Button type="submit" variant="primary" disabled={!query.trim()}>
          Show issues
        </Button>
      </div>
    </form>
  );
}

function IssueEmbedChrome({ node }: NodeViewProps) {
  return <IssueChip issueKey={String(node.attrs['key'] ?? '')} />;
}

function IssueTableChrome({ node, editor, updateAttributes }: NodeViewProps) {
  const attrs = {
    query: String(node.attrs['query'] ?? ''),
    title: String(node.attrs['title'] ?? ''),
  };
  if (!attrs.query && editor.isEditable)
    return <FilterForm initial={attrs} onSave={(next) => updateAttributes({ ...next })} />;
  return <IssueTableBlock {...attrs} />;
}

export const issueEmbedView: ViewSpec = {
  tag: 'span',
  className: () => '',
  attrs: (node) => ({ 'data-type': 'issueEmbed', 'data-key': String(node.attrs['key'] ?? '') }),
  chrome: { tag: 'span', className: '' },
  Component: IssueEmbedChrome,
};

export const issueTableView: ViewSpec = {
  tag: 'div',
  className: () => 'min-w-0',
  attrs: () => ({ 'data-type': 'issueTable' }),
  Component: IssueTableChrome,
};
