import { createElement as h, type ReactNode } from 'react';
import { Body, Container, Head, Hr, Html, Img, Link, Preview, Section, Text } from 'react-email';
import type { EmailBrand, EmailTheme } from './theme.ts';

/** Everything a template needs besides its own data. */
export interface EmailFrame {
  brand: EmailBrand;
  theme: EmailTheme;
  /** One line: "You're receiving this because you watch PLT-204." */
  reason: string;
  /** Per-kind unsubscribe page; present on every notification email. */
  unsubscribeUrl: string | null;
  /** Settings › Notifications in the app. */
  preferencesUrl: string | null;
}

/** A template's own part; the layout adds the header, reason line and footer. */
export interface EmailContent {
  subject: string;
  preview: string;
  body: ReactNode;
}

function LogoTile({ brand, theme }: { brand: EmailBrand; theme: EmailTheme }) {
  if (brand.logoUrl) {
    return h(
      'span',
      { 'data-text-skip': '' },
      h(Img, {
        src: brand.logoUrl,
        alt: brand.workspaceName,
        width: 28,
        height: 28,
        style: { borderRadius: '6px', display: 'inline-block', verticalAlign: 'middle' },
      }),
    );
  }
  const initial = brand.workspaceName.trim().charAt(0).toUpperCase() || 'B';
  return h(
    'span',
    {
      'data-text-skip': '',
      style: {
        display: 'inline-block',
        width: '28px',
        height: '28px',
        lineHeight: '28px',
        borderRadius: '6px',
        background: theme.button,
        color: theme.onButton,
        fontWeight: 600,
        fontSize: '14px',
        textAlign: 'center',
        verticalAlign: 'middle',
      },
    },
    initial,
  );
}

export function EmailLayout(props: { frame: EmailFrame; preview: string; children?: ReactNode }) {
  const { brand, theme, reason, unsubscribeUrl, preferencesUrl } = props.frame;
  const small = {
    fontSize: '12px',
    lineHeight: '18px',
    color: theme.textSubtle,
    margin: '0 0 6px',
  };
  return h(
    Html,
    { lang: 'en' },
    h(Head, null, h('meta', { name: 'color-scheme', content: 'light only' })),
    h(Preview, null, props.preview),
    h(
      Body,
      { style: { background: theme.page, fontFamily: theme.font, color: theme.text, margin: 0 } },
      h(
        Container,
        { style: { maxWidth: '560px', margin: '0 auto', padding: '32px 16px' } },
        h(
          Section,
          { style: { paddingBottom: '16px' } },
          h(LogoTile, { brand, theme }),
          h(
            'span',
            {
              style: {
                fontWeight: 600,
                fontSize: '14px',
                marginLeft: '10px',
                verticalAlign: 'middle',
              },
            },
            brand.workspaceName,
          ),
        ),
        h(
          Section,
          {
            style: {
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              borderRadius: '8px',
              padding: '24px',
            },
          },
          props.children,
        ),
        h(
          Section,
          { style: { padding: '16px 4px 0' } },
          h(Text, { style: small }, reason),
          unsubscribeUrl || preferencesUrl
            ? h(
                Text,
                { style: small },
                unsubscribeUrl
                  ? h(
                      Link,
                      { href: unsubscribeUrl, style: { color: theme.textMuted } },
                      'Unsubscribe',
                    )
                  : null,
                unsubscribeUrl && preferencesUrl ? ' · ' : null,
                preferencesUrl
                  ? h(
                      Link,
                      { href: preferencesUrl, style: { color: theme.textMuted } },
                      'Notification settings',
                    )
                  : null,
              )
            : null,
          h(Hr, { style: { borderColor: theme.border, margin: '12px 0' } }),
          h(Text, { style: small }, `Sent by Bemmoly for ${brand.workspaceName}.`),
        ),
      ),
    ),
  );
}
