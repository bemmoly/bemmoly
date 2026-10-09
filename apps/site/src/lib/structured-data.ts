/**
 * JSON-LD for search engines and assistants, typed against schema.org (schema-dts) so a
 * property that does not exist fails the typecheck. Only facts the site states elsewhere:
 * no ratings, no reviews, no numbers that are not in the release notes.
 */
import type {
  BreadcrumbList,
  FAQPage,
  Graph,
  Organization,
  SoftwareApplication,
  Thing,
  WebPage,
  WebSite,
} from 'schema-dts';
import { trailOf, type SitePage } from '../data/pages.ts';
import { LATEST } from './changelog.ts';
import { RELEASES_URL, REPO_URL, SITE_URL } from './links.ts';

export interface FaqItem {
  question: string;
  /** Plain text, the same words the page shows. */
  answer: string;
}

export interface StructuredDataInput {
  page: SitePage;
  canonical: string;
  logo: string;
  noindex: boolean;
  faq?: readonly FaqItem[];
}

const ids = {
  organization: `${SITE_URL}/#organization`,
  website: `${SITE_URL}/#website`,
  software: `${SITE_URL}/#software`,
};

function organization(logo: string): Organization {
  return {
    '@type': 'Organization',
    '@id': ids.organization,
    name: 'Bemmoly',
    url: `${SITE_URL}/`,
    logo: { '@type': 'ImageObject', url: logo, width: '512', height: '512' },
    sameAs: [REPO_URL],
  };
}

const website: WebSite = {
  '@type': 'WebSite',
  '@id': ids.website,
  name: 'Bemmoly',
  url: `${SITE_URL}/`,
  inLanguage: 'en',
  publisher: { '@id': ids.organization },
};

const software: SoftwareApplication = {
  '@type': 'SoftwareApplication',
  '@id': ids.software,
  name: 'Bemmoly',
  description:
    'Open source, self-hosted, AI-first issues and docs for a whole company: one application image and one Postgres on your own server.',
  url: `${SITE_URL}/`,
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'Project management',
  operatingSystem: 'Linux',
  softwareVersion: LATEST.version,
  license: 'https://opensource.org/licenses/MIT',
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  downloadUrl: RELEASES_URL,
  installUrl: `${SITE_URL}/docs/install`,
  releaseNotes: `${SITE_URL}/changelog`,
  memoryRequirements: '2 GB minimum, 4 GB recommended',
  storageRequirements: '10 GB',
  softwareRequirements: 'Ubuntu, Debian, Fedora or Amazon Linux; Docker is installed for you',
  sameAs: [REPO_URL],
  publisher: { '@id': ids.organization },
};

function breadcrumbs(page: SitePage, canonical: string): BreadcrumbList | null {
  const trail = trailOf(page.path);
  if (trail.length < 2) return null;
  return {
    '@type': 'BreadcrumbList',
    '@id': `${canonical}#breadcrumb`,
    itemListElement: trail.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: new URL(crumb.path, SITE_URL).href,
    })),
  };
}

function faqPage(faq: readonly FaqItem[], canonical: string): FAQPage {
  return {
    '@type': 'FAQPage',
    '@id': `${canonical}#faq`,
    mainEntity: faq.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };
}

export function structuredData({
  page,
  canonical,
  logo,
  noindex,
  faq,
}: StructuredDataInput): Graph {
  const trail = noindex ? null : breadcrumbs(page, canonical);
  const webPage: WebPage = {
    '@type': 'WebPage',
    '@id': `${canonical}#webpage`,
    url: canonical,
    name: page.title,
    description: page.description,
    inLanguage: 'en',
    isPartOf: { '@id': ids.website },
    ...(noindex ? {} : { dateModified: page.updated }),
    ...(trail ? { breadcrumb: { '@id': `${canonical}#breadcrumb` } } : {}),
    ...(page.software ? { about: { '@id': ids.software } } : {}),
  };
  const nodes: Thing[] = [organization(logo), website, webPage];
  if (page.software) nodes.push(software);
  if (trail) nodes.push(trail);
  if (faq && faq.length > 0) nodes.push(faqPage(faq, canonical));
  return { '@context': 'https://schema.org', '@graph': nodes };
}

/** JSON for a <script type="application/ld+json">: `<` is escaped so text cannot end the tag. */
export const jsonLd = (graph: Graph) => JSON.stringify(graph).replace(/</g, '\\u003c');
