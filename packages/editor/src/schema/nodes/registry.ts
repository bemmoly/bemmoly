import type { AnyExtension } from '@tiptap/core';
import { callout } from './callout.ts';
import { codeBlock } from './code-block.ts';
import { decision } from './decision.ts';
import { image } from './image.ts';
import { issueCard } from './issue-card.ts';
import { issueEmbed } from './issue-embed.ts';
import { issueTable } from './issue-table.ts';
import { mention } from './mention.ts';
import { pageLink } from './page-link.ts';
import { table } from './table.ts';
import { toc } from './toc.ts';
import type { DocNode } from './types.ts';
import { unsupportedBlock } from './unsupported-block.ts';

/** Every node beyond the base set, one line each. Adding a node is one file and one line. */
export const DOC_NODES: readonly DocNode[] = [
  callout,
  decision,
  pageLink,
  mention,
  toc,
  table,
  image,
  codeBlock,
  issueEmbed,
  issueCard,
  issueTable,
  unsupportedBlock,
];

const BY_NAME = new Map<string, DocNode>(DOC_NODES.map((node) => [node.name, node]));

/** The registered node of a type, if any; base nodes without extras have none. */
export function docNode(name: string): DocNode | undefined {
  return BY_NAME.get(name);
}

/** The schema extensions the registered nodes add to the base set. */
export function docNodeExtensions(): AnyExtension[] {
  return DOC_NODES.flatMap((node) => node.extensions());
}
