import { Button, Input } from '@bemmoly/ui';
import type { Editor } from '@tiptap/core';
import { useId, useState } from 'react';
import { SAFE_HREF } from '../view.tsx';

/** "example.org/x" gains https://; web, mail and in-app paths pass as written. */
export function normalizeHref(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || SAFE_HREF.test(trimmed)) return trimmed;
  if (/^[\w.-]+@[\w.-]+\.\w+$/.test(trimmed)) return `mailto:${trimmed}`;
  if (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

/** Links the selection, the link under the caret, or inserts the address as its own text. */
export function applyLink(editor: Editor, href: string): void {
  const chain = editor.chain().focus();
  if (!href) {
    chain.extendMarkRange('link').unsetLink().run();
    return;
  }
  if (editor.state.selection.empty && !editor.isActive('link')) {
    chain
      .insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] })
      .run();
    return;
  }
  chain.extendMarkRange('link').setLink({ href }).run();
}

export interface LinkFormProps {
  editor: Editor;
  /** Closes the form; focus goes back to the text. */
  onDone: () => void;
}

/** The address row that stands in for the tools while a link is written: Enter applies it. */
export function LinkForm({ editor, onDone }: LinkFormProps) {
  const id = useId();
  const [value, setValue] = useState(() => String(editor.getAttributes('link')['href'] ?? ''));
  const [error, setError] = useState<string | null>(null);
  const linked = editor.isActive('link');

  const apply = () => {
    const href = normalizeHref(value);
    if (href && !SAFE_HREF.test(href)) {
      setError('Links start with https://, mailto: or /.');
      return;
    }
    applyLink(editor, href);
    onDone();
  };

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <Input
        autoFocus
        aria-label="Link address"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        placeholder="https://"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            apply();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onDone();
          }
        }}
        wrapperClassName="min-w-0 flex-1"
      />
      {error && (
        <span id={`${id}-error`} role="alert" className="text-12 text-danger">
          {error}
        </span>
      )}
      <Button size="xs" variant="primary" onClick={apply}>
        Apply
      </Button>
      {linked && (
        <Button
          size="xs"
          variant="ghost"
          onClick={() => {
            applyLink(editor, '');
            onDone();
          }}
        >
          Remove
        </Button>
      )}
    </div>
  );
}
