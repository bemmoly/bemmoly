import type { RichTextDoc } from '@bemmoly/editor';
import { toHtmlDocument } from '@bemmoly/editor/convert';

/**
 * PDF goes through the browser's own print dialog ("Save as PDF"), so no PDF engine ships in
 * the app: the page is written as the same self-contained HTML the HTML export makes, with its
 * print rules, into a hidden frame that prints itself and goes away afterwards.
 */
export function printAsPdf(doc: RichTextDoc | null, title: string, origin: string): Promise<void> {
  const html = toHtmlDocument(doc, title || 'Untitled', {
    pageHref: (id) => `${origin}/docs/p/${id}`,
  });
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.title = `Print ${title || 'Untitled'}`;
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
