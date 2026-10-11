import type { MessageValues } from '@bemmoly/shared';
import { Fragment, type ReactNode } from 'react';

/** Draws one tag's text: `link: (text) => <Link to="/forgot-password">{text}</Link>`. */
export type RichTags = Readonly<Record<string, (text: string) => ReactNode>>;

/** Stands in for "<" inside values while tags are matched, so a name can never open one. */
const HELD = '';

const hold = (values: MessageValues | undefined): MessageValues | undefined =>
  values &&
  Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      typeof value === 'string' ? value.replaceAll('<', HELD) : value,
    ]),
  );

const release = (text: string) => text.replaceAll(HELD, '<');

const escape = (name: string) => name.replace(/[^\w-]/g, '');

/**
 * Formats a message, then draws each known `<tag>text</tag>` with its function. Tags do not
 * nest; an unknown tag stays as text, which the pseudo-locale run makes easy to spot.
 */
export function richText(
  format: (values: MessageValues | undefined) => string,
  values: MessageValues | undefined,
  tags: RichTags,
): ReactNode {
  const text = format(hold(values));
  const names = Object.keys(tags).map(escape).filter(Boolean);
  if (names.length === 0) return release(text);
  const pattern = new RegExp(`<(${names.join('|')})>([\\s\\S]*?)</\\1>`, 'g');
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const [whole, name = '', inner = ''] = match;
    if (match.index > last) parts.push(release(text.slice(last, match.index)));
    parts.push(<Fragment key={parts.length}>{tags[name]?.(release(inner))}</Fragment>);
    last = match.index + whole.length;
  }
  if (last < text.length) parts.push(release(text.slice(last)));
  return parts;
}
