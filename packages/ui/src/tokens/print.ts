/**
 * Print tokens: how a page reads on paper (a PDF export, or the browser's print view). Paper
 * is read at arm's length in points, not pixels, so print has its own small type scale and
 * page box. Colours are the Classic light theme's (a printed page never follows a workspace
 * preset or dark mode); these are only sizes, measures and the paper itself (ADR 0033).
 */

/** Five sizes: running header and footer, captions and code, body, section, title. */
export const PRINT_TYPE = {
  meta: '8pt',
  small: '9pt',
  body: '10.5pt',
  h3: '12pt',
  h2: '14pt',
  h1: '22pt',
} as const;

export const PRINT_LEADING = { body: '1.55', heading: '1.2' } as const;

/** Space between blocks, and the page box margins the header and footer sit in. */
export const PRINT_SPACE = { block: '8pt', section: '16pt' } as const;

export const PRINT_MARGINS = { top: '18mm', bottom: '18mm', side: '16mm' } as const;

/** The two papers a PDF prints on. */
export const PRINT_PAPERS = {
  a4: { label: 'A4', width: '210mm', height: '297mm' },
  letter: { label: 'Letter', width: '8.5in', height: '11in' },
} as const;

export type PrintPaper = keyof typeof PRINT_PAPERS;
