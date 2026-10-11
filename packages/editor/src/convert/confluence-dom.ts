import { DomUtils, parseDocument } from 'htmlparser2';

/*
 * The parsed Confluence storage format, read through a few helpers so the converter never
 * touches the parser's own types. Storage format is XHTML with `ac:` and `ri:` elements;
 * it is parsed as HTML so named entities such as &nbsp; decode, with CDATA kept for code.
 */

export type DomNode = ReturnType<typeof parseDocument>['children'][number];
export type DomElement = Extract<DomNode, { attribs: Record<string, string> }>;

export function parseStorage(xhtml: string): DomNode[] {
  return parseDocument(xhtml, { recognizeCDATA: true, recognizeSelfClosing: true }).children;
}

export const isElement = (node: DomNode): node is DomElement => 'name' in node && 'attribs' in node;

export const tagName = (node: DomNode) => (isElement(node) ? node.name.toLowerCase() : '');

export const childrenOf = (node: DomNode): DomNode[] =>
  'children' in node ? (node.children as DomNode[]) : [];

/** The text under a node, CDATA included. */
export const textContent = (node: DomNode): string => DomUtils.textContent(node);

export const outerXml = (node: DomNode): string => DomUtils.getOuterHTML(node);

export const attribute = (node: DomNode, name: string): string =>
  isElement(node) ? (node.attribs[name] ?? '') : '';

/** The direct child elements with a tag name. */
export const childElements = (node: DomNode, name: string): DomElement[] =>
  childrenOf(node).filter((child): child is DomElement => tagName(child) === name);

/** A macro's `<ac:parameter ac:name="…">` values by name. */
export function macroParameters(node: DomNode): Record<string, string> {
  return Object.fromEntries(
    childElements(node, 'ac:parameter').map((p) => [attribute(p, 'ac:name'), textContent(p)]),
  );
}
