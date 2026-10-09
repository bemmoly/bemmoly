import { codeLanguage } from '../schema/nodes/code-block.ts';
import type { RichTextNode } from '../types.ts';
import * as b from './build.ts';
import {
  attribute,
  childElements,
  macroParameters,
  outerXml,
  textContent,
  type DomNode,
} from './confluence-dom.ts';

/*
 * Confluence macros the schema has a node for. Each takes the macro element and a way to
 * convert rich-text bodies, and returns nodes; a macro not listed here becomes a labelled
 * unsupported block in from-confluence.ts, never nothing.
 */

export type BodyConverter = (body: DomNode | undefined) => RichTextNode[];
type MacroConverter = (macro: DomNode, body: BodyConverter) => RichTextNode[];

const ISSUE_KEY = /^[A-Z][A-Z0-9]{1,9}-[1-9][0-9]*$/;

const richBody = (macro: DomNode) => childElements(macro, 'ac:rich-text-body')[0];

const callout =
  (variant: string): MacroConverter =>
  (macro, body) => {
    const content = body(richBody(macro));
    const title = macroParameters(macro)['title'];
    const heading = title ? [b.paragraph([b.text(title, [{ type: 'bold' }])])] : [];
    const blocks = [...heading, ...content];
    return [
      { type: 'callout', attrs: { variant }, content: blocks.length ? blocks : [b.paragraph()] },
    ];
  };

const code: MacroConverter = (macro) => {
  const params = macroParameters(macro);
  const plain = childElements(macro, 'ac:plain-text-body')[0];
  const source = plain ? textContent(plain) : '';
  const language = params['language'] ? (codeLanguage(params['language']) ?? null) : null;
  return [b.codeBlock(source.replace(/\n$/, ''), language)];
};

const jira: MacroConverter = (macro) => {
  const params = macroParameters(macro);
  const key = (params['key'] ?? '').trim();
  if (ISSUE_KEY.test(key)) return [{ type: 'issueEmbed', attrs: { key } }];
  const query = (params['jqlQuery'] ?? '').trim();
  if (query) return [{ type: 'issueTable', attrs: { query, title: '' } }];
  return [unsupported(macro)];
};

/** Blocks inside an expand or a section: the content, without the frame. */
const unwrap: MacroConverter = (macro, body) => body(richBody(macro));

export const MACROS: Record<string, MacroConverter> = {
  info: callout('info'),
  note: callout('note'),
  tip: callout('success'),
  warning: callout('warning'),
  panel: callout('note'),
  code,
  'code-block': code,
  noformat: code,
  toc: () => [{ type: 'toc', attrs: { maxLevel: 3 } }],
  jira,
  expand: unwrap,
  section: unwrap,
  column: unwrap,
};

/** A macro the schema cannot hold, kept whole and labelled where it stood. */
export function unsupported(macro: DomNode): RichTextNode {
  return {
    type: 'unsupportedBlock',
    attrs: { source: 'confluence', name: attribute(macro, 'ac:name'), raw: outerXml(macro) },
  };
}
