/**
 * Where each capability stands, for the topic pages. "now" is in the release the installer
 * pulls today; the others follow the README's status table (tech design §24). A capability
 * that is not in a released version never gets the "now" label.
 */
import type { BadgeTone } from '../lib/badge.ts';

export const AVAILABILITY = {
  now: { label: 'available now', tone: 'ok' },
  docs: { label: 'Docs module, 0.3', tone: 'neutral' },
  ai: { label: 'AI, 0.4', tone: 'neutral' },
  integrations: { label: 'planned for 0.5', tone: 'neutral' },
  launch: { label: 'planned for 1.0', tone: 'neutral' },
  planned: { label: 'planned', tone: 'neutral' },
} as const satisfies Record<string, { label: string; tone: BadgeTone }>;

export type Availability = keyof typeof AVAILABILITY;

export interface Capability {
  /** Two letters in a tile, as the landing page's feature grid draws them. */
  tile: string;
  title: string;
  body: string;
  status: Availability;
}
