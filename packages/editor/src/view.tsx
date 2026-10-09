import type { MouseEvent, ReactNode } from 'react';
import { proseClass } from './prose.ts';
import type { ProseSize, RichTextDoc, RichTextNode } from './types.ts';

/*
 * Prints a stored document without loading the editor. Every node becomes the element the
 * editor's schema renders it as (strong, em, ul[data-type=taskList], span[data-type=mention]),
 * under the same class list, so reading and editing look alike. Nodes this build does not know,
 * such as a module's embed when that module is off, print their text rather than vanish.
 */

/** Links the view follows: the web, mail and paths inside the app. */
export const SAFE_HREF = /^(https?:|mailto:|\/(?!\/))/i;

type Navigate = (href: string, event: MouseEvent<HTMLAnchorElement>) => void;

function marked(text: ReactNode, node: RichTextNode, key: number, navigate?: Navigate) {
  return (node.marks ?? []).reduce<ReactNode>((inner, mark) => {
    switch (mark.type) {
      case 'bold':
        return <strong key={key}>{inner}</strong>;
      case 'italic':
        return <em key={key}>{inner}</em>;
      case 'strike':
        return <s key={key}>{inner}</s>;
      case 'code':
        return <code key={key}>{inner}</code>;
      case 'link': {
        const href = String(mark.attrs?.['href'] ?? '');
        if (!SAFE_HREF.test(href)) return inner;
        return (
          <a
            key={key}
            href={href}
            rel="noopener noreferrer nofollow"
            onClick={navigate ? (event) => navigate(href, event) : undefined}
          >
            {inner}
          </a>
        );
      }
      default:
        return inner;
    }
  }, text);
}

function inline(nodes: RichTextNode[] | undefined, navigate?: Navigate): ReactNode[] {
  return (nodes ?? []).map((node, index) => {
    if (node.type === 'text') return marked(node.text ?? '', node, index, navigate);
    if (node.type === 'hardBreak') return <br key={index} />;
    if (node.type === 'mention') {
      const label = String(node.attrs?.['label'] ?? node.attrs?.['id'] ?? '');
      return (
        <span
          key={index}
          data-type="mention"
          data-id={String(node.attrs?.['id'] ?? '')}
          data-label={label}
        >
          @{label}
        </span>
      );
    }
    return <span key={index}>{inline(node.content, navigate)}</span>;
  });
}

/** An empty paragraph keeps one line, as the editor's trailing break gives it. */
function lineOf(node: RichTextNode, navigate?: Navigate): ReactNode {
  return node.content?.length ? inline(node.content, navigate) : <br />;
}

function blocks(nodes: RichTextNode[] | undefined, navigate?: Navigate): ReactNode[] {
  return (nodes ?? []).map((node, index) => block(node, index, navigate));
}

function block(node: RichTextNode, key: number, navigate?: Navigate): ReactNode {
  const children = () => blocks(node.content, navigate);
  switch (node.type) {
    case 'paragraph':
      return <p key={key}>{lineOf(node, navigate)}</p>;
    case 'heading': {
      const level = Number(node.attrs?.['level'] ?? 2);
      const Tag = level === 1 ? 'h1' : level === 3 ? 'h3' : 'h2';
      return <Tag key={key}>{inline(node.content, navigate)}</Tag>;
    }
    case 'bulletList':
      return <ul key={key}>{children()}</ul>;
    case 'orderedList': {
      const start = Number(node.attrs?.['start'] ?? 1);
      return (
        <ol key={key} {...(start !== 1 ? { start } : {})}>
          {children()}
        </ol>
      );
    }
    case 'listItem':
      return <li key={key}>{children()}</li>;
    case 'taskList':
      return (
        <ul key={key} data-type="taskList">
          {children()}
        </ul>
      );
    case 'taskItem': {
      const checked = Boolean(node.attrs?.['checked']);
      return (
        <li key={key} data-checked={String(checked)} data-type="taskItem">
          <label>
            <input
              type="checkbox"
              checked={checked}
              readOnly
              tabIndex={-1}
              aria-readonly
              aria-label={checked ? 'Done' : 'Not done'}
              onClick={(event) => event.preventDefault()}
            />
            <span />
          </label>
          <div>{children()}</div>
        </li>
      );
    }
    case 'blockquote':
      return <blockquote key={key}>{children()}</blockquote>;
    case 'codeBlock':
      return (
        <pre key={key}>
          <code>{inline(node.content, navigate)}</code>
        </pre>
      );
    case 'horizontalRule':
      return <hr key={key} />;
    default:
      return node.content?.some((child) => child.type === 'text') || !node.content ? (
        <p key={key}>{lineOf(node, navigate)}</p>
      ) : (
        <div key={key}>{children()}</div>
      );
  }
}

export interface RichTextViewProps {
  doc: RichTextDoc | null | undefined;
  size?: ProseSize;
  className?: string;
  /** Called on a link click, so paths inside the app can move without a reload. */
  onNavigate?: Navigate;
}

/** A stored document, read-only, exactly as the editor shows it. */
export function RichTextView({ doc, size = 'page', className, onNavigate }: RichTextViewProps) {
  return <div className={proseClass(size, className)}>{blocks(doc?.content, onNavigate)}</div>;
}
