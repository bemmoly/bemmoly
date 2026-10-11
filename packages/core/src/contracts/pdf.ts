/** Paper sizes the PDF renderer prints on. */
export type PdfPaper = 'a4' | 'letter';

export interface PdfRenderInput {
  /** A whole, self-contained HTML document: styles inline, images as data: URIs. */
  html: string;
  /** Chromium header and footer templates; their classes fill in the title and page numbers. */
  headerHtml?: string;
  footerHtml?: string;
  paper: PdfPaper;
}

/**
 * The optional PDF component: a headless Chromium beside the app that turns one HTML
 * document into a PDF. Absent from the module context when no renderer is configured, so a
 * caller that has none falls back instead of failing.
 */
export interface PdfRenderer {
  /** The app's public URL: links on paper must be absolute to be followed. */
  readonly publicUrl: string;
  render(input: PdfRenderInput): Promise<Buffer>;
}
