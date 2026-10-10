/**
 * Where each capability stands, for the topic pages. "now" is in the release the installer
 * pulls today; the others follow the README's status table (tech design §24). A capability
 * that is not in a released version never gets the "now" label, and nothing unreleased gets a
 * release number: plans move, and a version on unbuilt work turns into a false claim.
 */
import type { BadgeTone } from '../lib/badge.ts';
import type { SiteIconName } from '../lib/icons.ts';
import { DOCS_SINCE, shippedLabel } from '../lib/changelog.ts';

export const AVAILABILITY = {
  now: { label: 'available now', tone: 'ok' },
  docs: { label: shippedLabel(DOCS_SINCE).toLowerCase(), tone: 'ok' },
  ai: { label: 'AI, coming', tone: 'ai' },
  integrations: { label: 'planned', tone: 'neutral' },
  launch: { label: 'planned', tone: 'neutral' },
  planned: { label: 'planned', tone: 'neutral' },
} as const satisfies Record<string, { label: string; tone: BadgeTone }>;

export type Availability = keyof typeof AVAILABILITY;

export interface Capability {
  /** A drawn icon from the product's set, never letters in a box. */
  icon: SiteIconName;
  title: string;
  body: string;
  status: Availability;
}
