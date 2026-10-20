import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RichTextDoc } from '../../types.ts';
import { RichTextView } from '../../view.tsx';

afterEach(cleanup);

const doc = (attrs: Record<string, string>): RichTextDoc => ({
  type: 'doc',
  content: [{ type: 'file', attrs }],
});

const SRC = '/api/v1/files/0199c0de-0000-7000-8000-0000000000b1';

describe('the File block', () => {
  it('runs HTML in a sandbox with scripts but no origin of ours', () => {
    render(
      <RichTextView doc={doc({ src: SRC, name: 'report.html', mime: 'text/html' })} size="doc" />,
    );
    const frame = screen.getByTitle('report.html');
    const sandbox = frame.getAttribute('sandbox') ?? '';
    expect(sandbox.split(' ')).toContain('allow-scripts');
    expect(sandbox).not.toContain('allow-same-origin');
    expect(screen.getByText('HTML')).toBeTruthy();
  });

  it('frames a PDF for the browser viewer, and expands to full screen', () => {
    render(
      <RichTextView
        doc={doc({ src: SRC, name: 'spec.pdf', mime: 'application/pdf' })}
        size="doc"
      />,
    );
    expect(screen.getByTitle('spec.pdf').hasAttribute('sandbox')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Expand spec.pdf' }));
    expect(screen.getAllByTitle('spec.pdf')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  });

  it('prints only the name for a source or type it cannot show', () => {
    render(
      <RichTextView
        doc={doc({ src: 'javascript:alert(1)', name: 'x.html', mime: 'text/html' })}
        size="doc"
      />,
    );
    expect(screen.getByText('x.html')).toBeTruthy();
    expect(document.querySelector('iframe')).toBeNull();
  });
});
