import type { ReactNode } from 'react';
import { buildToc } from '../convert/outline.ts';
import { unsupportedLabel } from '../schema/nodes/values.ts';
import type { RichTextDoc, RichTextNode } from '../types.ts';
import { useDocServices } from './context.ts';
import {
  calloutClass,
  NODE_BODY,
  PAGE_LINK,
  PLACEHOLDER_CARD,
  TABLE,
  TABLE_WRAP,
  TOC_BOX,
} from './styles.ts';
import { CalloutHeader, calloutVariant } from './views/callout-view.tsx';
import { decisionClass, DecisionHeader, decisionState } from './views/decision-view.tsx';
import { ImageFigure } from './views/image-view.tsx';
import { IssueChip, IssueTableBlock } from './views/issue-views.tsx';
import { TocList } from './views/toc-view.tsx';

/*
 * The Docs nodes in the read-only view, drawn by the same pieces as the editor's node views
 * so a page reads the same in both. Nothing here loads ProseMirror: the view stays light.
 */

const str = (node: RichTextNode, name: string) => {
  const value = node.attrs?.[name];
  return typeof value === 'string' ? value : '';
};

function PageLink({ node }: { node: RichTextNode }) {
  const { pageHref, onNavigate } = useDocServices();
  const title = str(node, 'title') || 'Untitled';
  const href = pageHref?.(str(node, 'pageId'));
  if (!href)
    return (
      <span data-type="pageLink" className={PAGE_LINK}>
        {title}
      </span>
    );
  return (
    <a
      data-type="pageLink"
      href={href}
      className={PAGE_LINK}
      onClick={(event) => {
        if (!onNavigate || event.metaKey || event.ctrlKey) return;
        event.preventDefault();
        onNavigate(href);
      }}
    >
      {title}
    </a>
  );
}

/** An inline Docs node, or undefined when the node is not one. */
export function docInline(node: RichTextNode, key: number): ReactNode | undefined {
  if (node.type === 'pageLink') return <PageLink key={key} node={node} />;
  if (node.type === 'issueEmbed') return <IssueChip key={key} issueKey={str(node, 'key')} />;
  return undefined;
}

export interface BlockContext {
  doc: RichTextDoc | null | undefined;
  /** The node's children, printed as blocks. */
  children: () => ReactNode;
}

/** A block Docs node, or undefined when the node is not one. */
export function docBlock(
  node: RichTextNode,
  key: number,
  context: BlockContext,
): ReactNode | undefined {
  switch (node.type) {
    case 'callout': {
      const variant = calloutVariant(node.attrs?.['variant']);
      return (
        <div key={key} data-type="callout" data-variant={variant} className={calloutClass(variant)}>
          <CalloutHeader variant={variant} />
          <div className={NODE_BODY}>{context.children()}</div>
        </div>
      );
    }
    case 'decision': {
      const state = decisionState(node.attrs?.['state']);
      return (
        <div key={key} data-type="decision" className={decisionClass(state)}>
          <DecisionHeader state={state} decidedOn={str(node, 'decidedOn') || null} />
          <div className={NODE_BODY}>{context.children()}</div>
        </div>
      );
    }
    case 'toc':
      return (
        <nav key={key} data-type="toc" aria-label="Contents" className={TOC_BOX}>
          <TocList entries={buildToc(context.doc, Number(node.attrs?.['maxLevel'] ?? 3))} />
        </nav>
      );
    case 'table':
      return (
        <div key={key} className={TABLE_WRAP}>
          <table className={TABLE}>
            <tbody>{context.children()}</tbody>
          </table>
        </div>
      );
    case 'tableRow':
      return <tr key={key}>{context.children()}</tr>;
    case 'tableHeader':
    case 'tableCell': {
      const Tag = node.type === 'tableHeader' ? 'th' : 'td';
      const colSpan = Number(node.attrs?.['colspan'] ?? 1);
      const rowSpan = Number(node.attrs?.['rowspan'] ?? 1);
      return (
        <Tag key={key} {...(colSpan > 1 ? { colSpan } : {})} {...(rowSpan > 1 ? { rowSpan } : {})}>
          {context.children()}
        </Tag>
      );
    }
    case 'image':
      return <ImageFigure key={key} src={str(node, 'src')} alt={str(node, 'alt')} />;
    case 'issueTable':
      return <IssueTableBlock key={key} query={str(node, 'query')} title={str(node, 'title')} />;
    case 'unsupportedBlock':
      return (
        <div key={key} data-type="unsupportedBlock" className={PLACEHOLDER_CARD}>
          {unsupportedLabel(str(node, 'source'), str(node, 'name'))}
        </div>
      );
    default:
      return undefined;
  }
}
