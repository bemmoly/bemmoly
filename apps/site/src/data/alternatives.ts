/**
 * The two comparison pages (/jira-alternative, /confluence-alternative): the only pages where
 * another product's name appears outside an import label (content.md, Other products' names;
 * tests/seo.test.ts). Every statement about the other product is a fact its maker publishes,
 * linked to the page that says it; everything about Bemmoly is in the release notes or the code.
 * Nothing here disparages, and nothing borrows the other product's look.
 */
import { LICENSE_URL, sourceUrl } from '../lib/links.ts';

export interface Source {
  label: string;
  href: string;
}

/** Atlassian's own pages, each read on 2026-10-11 for the sentence the comparison quotes. */
export const ATLASSIAN = {
  dataResidency: {
    label: 'Atlassian: Understand data residency',
    href: 'https://support.atlassian.com/security-and-access-policies/docs/understand-data-residency/',
  },
  customerAgreement: {
    label: 'Atlassian Customer Agreement',
    href: 'https://www.atlassian.com/legal/atlassian-customer-agreement',
  },
  jiraPricing: {
    label: 'Atlassian: Jira pricing',
    href: 'https://www.atlassian.com/software/jira/pricing',
  },
  confluencePricing: {
    label: 'Atlassian: Confluence pricing',
    href: 'https://www.atlassian.com/software/confluence/pricing',
  },
  serverEnd: {
    label: 'Atlassian: the journey to cloud (2020)',
    href: 'https://www.atlassian.com/blog/announcements/journey-to-cloud',
  },
  dataCenterEnd: {
    label: 'Atlassian: Data Center end of life',
    href: 'https://www.atlassian.com/migration/assess/journey-to-cloud',
  },
  trademarks: {
    label: 'Atlassian trademark guidelines',
    href: 'https://www.atlassian.com/legal/trademark',
  },
} as const satisfies Record<string, Source>;

export interface ComparisonRow {
  /** The row's heading. */
  topic: string;
  bemmoly: string;
  bemmolySource?: Source;
  other: string;
  otherSource?: Source;
}

const LICENCE: Source = { label: 'LICENSE', href: LICENSE_URL };
const SEATS: Source = {
  label: 'Settings › Members',
  href: sourceUrl('apps/web/src/hooks/use-users.ts'),
};
const WHERE_DATA: Source = { label: 'On-premise', href: '/on-premise' };

/** The rows both pages share, worded for the product in the other column. */
function sharedRows(product: 'Jira' | 'Confluence'): ComparisonRow[] {
  return [
    {
      topic: 'Where it runs',
      bemmoly: 'Your own server: a Linux VM in your cloud account or a machine in your rack.',
      bemmolySource: { label: 'Self-hosting', href: '/self-hosting' },
      other: 'Atlassian’s cloud, which runs in AWS regions.',
      otherSource: ATLASSIAN.dataResidency,
    },
    {
      topic: 'Licence',
      bemmoly: 'MIT, open source. Every feature is in the public repository.',
      bemmolySource: LICENCE,
      other: 'Proprietary, used under the Atlassian Customer Agreement.',
      otherSource: ATLASSIAN.customerAgreement,
    },
    {
      topic: 'Pricing model',
      bemmoly: 'None. No subscription, plans, tiers or seat limits; you pay only for your server.',
      bemmolySource: SEATS,
      other:
        product === 'Jira'
          ? 'Subscription plans: Free, Standard, Premium and Enterprise.'
          : 'Subscription plans, free and paid.',
      otherSource: product === 'Jira' ? ATLASSIAN.jiraPricing : ATLASSIAN.confluencePricing,
    },
    {
      topic: 'Where your data lives',
      bemmoly:
        'In your Postgres and your server’s folders, or an S3-compatible bucket you choose for files and backups.',
      bemmolySource: WHERE_DATA,
      other:
        'Atlassian’s Global location by default; a chosen location on Standard, Premium and Enterprise plans.',
      otherSource: ATLASSIAN.dataResidency,
    },
  ];
}

export const JIRA_COMPARISON: readonly ComparisonRow[] = [
  ...sharedRows('Jira'),
  {
    topic: 'Bringing work across',
    bemmoly:
      'Import from Jira (Cloud and Data Center): projects, issues, comments, attachments, boards and sprints, with a preview before anything is written.',
    bemmolySource: { label: 'Release notes', href: '/changelog' },
    other: 'The source of the import.',
  },
];

export const CONFLUENCE_COMPARISON: readonly ComparisonRow[] = [
  ...sharedRows('Confluence'),
  {
    topic: 'Bringing work across',
    bemmoly:
      'Import from Confluence (Cloud and Data Center) or a space export: page trees, comments, labels and attachments, with a preview first.',
    bemmolySource: { label: 'Release notes', href: '/changelog' },
    other: 'The source of the import.',
  },
];

/** The column heading for the other product: what is compared is its hosted service. */
export const OTHER_COLUMN = {
  jira: 'Jira (Atlassian cloud)',
  confluence: 'Confluence (Atlassian cloud)',
} as const;

/** The trademark notice in the footer of both pages, word for word as the owner set it. */
export const TRADEMARK_NOTE =
  'Jira and Confluence are trademarks of Atlassian. Bemmoly is not affiliated with or endorsed by Atlassian.';

export interface MigrationStep {
  title: string;
  body: string;
}
