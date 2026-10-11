import type { RichTextDoc } from '@bemmoly/editor';
import { toPrintDocument } from '@bemmoly/editor/print';

/**
 * PDF without the server's renderer goes through the browser's own print dialog ("Save as
 * PDF"): the page is written as the same print document the renderer gets, with its print
 * stylesheet, into a hidden frame that prints itself and goes away afterwards. Paper size and
 * the running header are the browser's.
 */
export function printAsPdf(
  doc: RichTextDoc | null,
  page: { id: string; title: string },
  origin: string,
): Promise<void> {
  const title = page.title || 'Untitled';
  const { html } = toPrintDocument(title, [{ id: page.id, title, doc, depth: 0 }], {
    paper: 'a4',
    pageHref: (id) => `${origin}/docs/p/${id}`,
  });
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.title = `Print ${title}`;
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0';
    const done = () => {
      window.setTimeout(() => frame.remove(), 500);
      resolve();
    };
    frame.onload = () => {
      const view = frame.contentWindow;
      if (!view) {
        frame.remove();
        reject(new Error('The browser did not open the print view'));
        return;
      }
      view.addEventListener('afterprint', done, { once: true });
      view.focus();
      view.print();
      // Some browsers never fire afterprint for a frame; print() returns once the dialog closes.
      done();
    };
    frame.srcdoc = html;
    document.body.append(frame);
  });
}
