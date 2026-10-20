import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { expectAccessible } from '../testing/a11y.ts';
import { FileEmbed, fileEmbedKind } from './file-embed/index.ts';

afterEach(cleanup);

const SRC = '/api/v1/files/0199c0de-0000-7000-8000-0000000000c1';

describe('FileEmbed', () => {
  it('names the file and its kind, and frames HTML in a sandbox of its own', async () => {
    const { container } = render(
      <FileEmbed src={SRC} name="q3.html" kind="html" byline="Added by Release agent" />,
    );
    expect(screen.getByText('q3.html')).toBeTruthy();
    expect(screen.getByText('HTML · Added by Release agent')).toBeTruthy();
    const frame = screen.getByTitle('q3.html');
    expect(frame.getAttribute('sandbox')).toBe(
      'allow-scripts allow-popups allow-popups-to-escape-sandbox',
    );
    expect(screen.getByRole('button', { name: 'Download q3.html' })).toBeTruthy();
    await expectAccessible(container);
  });

  it('expands to a full-screen viewer that keeps the bar, and closes', async () => {
    render(<FileEmbed src={SRC} name="spec.pdf" kind="pdf" />);
    fireEvent.click(screen.getByRole('button', { name: 'Expand spec.pdf' }));
    const dialog = screen.getByRole('dialog', { name: 'spec.pdf' });
    expect(dialog.querySelector('iframe[title="spec.pdf"]')?.hasAttribute('sandbox')).toBe(false);
    expect(within(dialog).getByRole('button', { name: 'Open spec.pdf in a new tab' })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
  });

  it('reads the kind from the sniffed type', () => {
    expect(fileEmbedKind('text/html')).toBe('html');
    expect(fileEmbedKind('application/pdf')).toBe('pdf');
    expect(fileEmbedKind('image/webp')).toBe('image');
    expect(fileEmbedKind('application/zip')).toBeNull();
  });
});
