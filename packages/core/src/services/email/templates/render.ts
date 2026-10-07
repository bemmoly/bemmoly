import { createElement as h } from 'react';
import { render } from 'react-email';
import { EmailLayout, type EmailContent, type EmailFrame } from './layout.ts';

export interface RenderedEmail {
  subject: string;
  html: string;
  /** Always generated, so clients that prefer text and spam filters both get one. */
  text: string;
}

/** The logo tile is decoration; headings keep their case in the text part. */
const TEXT_OPTIONS = {
  selectors: [
    { selector: '[data-text-skip]', format: 'skip' },
    { selector: 'h1', options: { uppercase: false } },
  ],
};

export async function renderEmail(
  frame: EmailFrame,
  content: EmailContent,
): Promise<RenderedEmail> {
  const element = h(EmailLayout, { frame, preview: content.preview, children: content.body });
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true, htmlToTextOptions: TEXT_OPTIONS }),
  ]);
  return { subject: content.subject, html, text: text.trim() };
}
