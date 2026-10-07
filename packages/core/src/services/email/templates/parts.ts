import { createElement as h, type ReactNode } from 'react';
import { Button, Heading, Link, Section, Text } from 'react-email';
import type { EmailTheme } from './theme.ts';

export function Title({ theme, children }: { theme: EmailTheme; children?: ReactNode }) {
  return h(
    Heading,
    {
      as: 'h1',
      style: {
        fontSize: '18px',
        lineHeight: '26px',
        fontWeight: 600,
        margin: '0 0 12px',
        color: theme.text,
      },
    },
    children,
  );
}

export function Paragraph({ theme, children }: { theme: EmailTheme; children?: ReactNode }) {
  return h(
    Text,
    { style: { fontSize: '14px', lineHeight: '22px', margin: '0 0 12px', color: theme.text } },
    children,
  );
}

export function Muted({ theme, children }: { theme: EmailTheme; children?: ReactNode }) {
  return h(
    Text,
    { style: { fontSize: '13px', lineHeight: '20px', margin: '0 0 8px', color: theme.textMuted } },
    children,
  );
}

export function ActionButton(props: { theme: EmailTheme; href: string; children?: ReactNode }) {
  return h(
    Section,
    { style: { margin: '8px 0 16px' } },
    h(
      Button,
      {
        href: props.href,
        style: {
          background: props.theme.button,
          color: props.theme.onButton,
          borderRadius: '6px',
          fontSize: '14px',
          fontWeight: 600,
          padding: '9px 16px',
          textDecoration: 'none',
        },
      },
      props.children,
    ),
  );
}

/** A quoted body, such as a comment or an inviter's note. */
export function Quote({ theme, children }: { theme: EmailTheme; children?: ReactNode }) {
  return h(
    Text,
    {
      style: {
        fontSize: '14px',
        lineHeight: '22px',
        margin: '0 0 16px',
        padding: '10px 14px',
        background: theme.tint,
        borderLeft: `3px solid ${theme.tintBorder}`,
        borderRadius: '4px',
        color: theme.text,
        whiteSpace: 'pre-wrap',
      },
    },
    children,
  );
}

export function TargetLink(props: {
  theme: EmailTheme;
  href: string | null;
  children?: ReactNode;
}) {
  if (!props.href) return h('b', null, props.children);
  return h(
    Link,
    { href: props.href, style: { color: props.theme.link, fontWeight: 600 } },
    props.children,
  );
}

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

/** Emails are read later and elsewhere, so times carry their zone. */
export function formatDateTime(date: Date): string {
  return `${DATE_FORMAT.format(date)} UTC`;
}
