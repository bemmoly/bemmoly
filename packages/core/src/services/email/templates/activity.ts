import { createElement as h, Fragment } from 'react';
import { Hr, Link, Section, Text } from 'react-email';
import type { EmailContent, EmailFrame } from './layout.ts';
import { ActionButton, formatDateTime, Muted, Paragraph, Quote, TargetLink } from './parts.ts';

export interface ActivityLine {
  /** "Aisha K. and 2 others commented on" or "Priya N. mentioned you in". */
  lead: string;
  targetLabel: string;
  targetUrl: string | null;
  body: string;
  createdAt: Date;
}

export interface NotificationEmailData extends ActivityLine {
  /** For the subject when no person caused it, e.g. "Update on PLT-204". */
  hasActor: boolean;
}

export function notificationEmail(frame: EmailFrame, data: NotificationEmailData): EmailContent {
  const { theme } = frame;
  const subject = data.hasActor
    ? `${data.lead} ${data.targetLabel}`
    : `Update on ${data.targetLabel}`;
  return {
    subject,
    preview: data.body || subject,
    body: h(
      Fragment,
      null,
      h(
        Paragraph,
        { theme },
        `${data.lead} `,
        h(TargetLink, { theme, href: data.targetUrl }, data.targetLabel),
      ),
      data.body ? h(Quote, { theme }, data.body) : null,
      data.targetUrl
        ? h(ActionButton, { theme, href: data.targetUrl }, `Open ${data.targetLabel}`)
        : null,
      h(Muted, { theme }, formatDateTime(data.createdAt)),
    ),
  };
}

export interface DigestEmailData {
  lines: readonly ActivityLine[];
  /** Rows beyond the lines shown, summed up as "and 12 more". */
  moreCount: number;
  inboxUrl: string;
  /** "in the last 10 minutes" or "since yesterday's summary". */
  period: string;
}

export const DIGEST_LINE_LIMIT = 20;

export function digestEmail(frame: EmailFrame, data: DigestEmailData): EmailContent {
  const { theme, brand } = frame;
  const total = data.lines.length + data.moreCount;
  const noun = total === 1 ? 'update' : 'updates';
  return {
    subject: `${total} new ${noun} in ${brand.workspaceName}`,
    preview: data.lines[0] ? `${data.lines[0].lead} ${data.lines[0].targetLabel}` : '',
    body: h(
      Fragment,
      null,
      h(Paragraph, { theme }, `${total} new ${noun} ${data.period}.`),
      ...data.lines.map((line, index) =>
        h(
          Section,
          { key: index, style: { padding: '10px 0', borderTop: `1px solid ${theme.border}` } },
          h(
            Text,
            { style: { fontSize: '14px', lineHeight: '21px', margin: 0, color: theme.text } },
            `${line.lead} `,
            h(TargetLink, { theme, href: line.targetUrl }, line.targetLabel),
          ),
          line.body
            ? h(
                Text,
                {
                  style: {
                    fontSize: '13px',
                    lineHeight: '20px',
                    margin: '2px 0 0',
                    color: theme.textMuted,
                  },
                },
                line.body,
              )
            : null,
        ),
      ),
      h(Hr, { style: { borderColor: theme.border, margin: '4px 0 12px' } }),
      data.moreCount > 0
        ? h(
            Muted,
            { theme },
            `And ${data.moreCount} more in `,
            h(Link, { href: data.inboxUrl, style: { color: theme.link } }, 'your inbox'),
            '.',
          )
        : null,
      h(ActionButton, { theme, href: data.inboxUrl }, 'Open inbox'),
    ),
  };
}
