import type { ViewSpec } from '../portals.ts';
import { calloutView } from './callout-view.tsx';
import { decisionView } from './decision-view.tsx';
import { imageView } from './image-view.tsx';
import { issueEmbedView, issueTableView } from './issue-views.tsx';
import { tocView } from './toc-view.tsx';

/**
 * How a node looks while editing, for the nodes that need more than their schema's HTML: one
 * line per node. The rest (page links, tables, unsupported blocks) draw from their schema and
 * the prose and table classes.
 */
export const NODE_VIEWS: Readonly<Record<string, ViewSpec>> = {
  callout: calloutView,
  decision: decisionView,
  toc: tocView,
  image: imageView,
  issueEmbed: issueEmbedView,
  issueTable: issueTableView,
};
