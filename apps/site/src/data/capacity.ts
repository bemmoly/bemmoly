/**
 * How big a server Bemmoly needs, from capacity.json (the load test writes that file). Every
 * capacity number the site shows goes through here, so tests/capacity.test.ts can check that
 * each one on the page comes from the file. A size is either measured, with its numbers, or
 * being measured, with none: nothing here is invented or extrapolated beyond the stated
 * assumption.
 */
import data from './capacity.json';

export type CapacityStatus = 'measured' | 'measuring';

export interface Price {
  provider: string;
  instance: string;
  monthly: number;
  currency: 'USD' | 'EUR';
}

export interface ServerSize {
  cpu: number;
  ramGb: number;
  status: CapacityStatus;
  recommended: boolean;
  /** The highest measured load within the latency budget; null while measuring. */
  requestsPerSecond: number | null;
  issues: number | null;
  docs: number | null;
  load: Load | null;
  notes: string;
  prices: Price[];
}

export interface Load {
  p95Ms: { board: number; issue: number; search: number; docPage: number; issueEdit: number };
  soak: {
    minutes: number;
    rps: number;
    requests: number;
    errors: number;
    p95Ms: [number, number];
    appMemoryMb: number;
  };
  liveEditing: { delivered: number; sent: number };
  data: {
    issues: number;
    largestProject: number;
    comments: number;
    docPages: number;
    users: number;
    projects: number;
    importIssues: number;
    importSeconds: number;
  };
}

export const CAPACITY = data as {
  setup: string;
  priceNote: string;
  assumption: { requestsPerActiveUserPerSecond: number; activeShare: number; text: string };
  sizes: ServerSize[];
};

export const sizeName = (size: ServerSize) => `${size.cpu} vCPU, ${size.ramGb} GB`;

export const fmt = (value: number) => value.toLocaleString('en-US');

export const money = (price: Pick<Price, 'monthly' | 'currency'>) =>
  `${price.currency === 'EUR' ? '€' : '$'}${fmt(price.monthly)}`;

/** Prices low to high. */
export const byPrice = (size: ServerSize) => [...size.prices].sort((a, b) => a.monthly - b.monthly);

/**
 * The card's "from" line: the cheapest US-dollar price whose instance is exactly this size
 * (an instance noted with other specs in parentheses, like a bigger smallest plan, is skipped).
 */
export function cheapest(size: ServerSize): Price | undefined {
  return byPrice(size).find((price) => price.currency === 'USD' && !price.instance.includes('('));
}

export const MEASURED = CAPACITY.sizes.find(
  (size): size is ServerSize & { load: Load } => size.status === 'measured' && size.load !== null,
);

/** Round down to two significant figures, so an estimate never rounds up. */
const floorRound = (value: number) => {
  const step = 10 ** Math.max(0, Math.floor(Math.log10(value)) - 1);
  return Math.floor(value / step) * step;
};

/** People a size serves, computed from its measured load and the written-out assumption. */
export function peopleOf(size: ServerSize): { atOnce: number; organisation: number } | null {
  if (size.requestsPerSecond === null) return null;
  const { requestsPerActiveUserPerSecond, activeShare } = CAPACITY.assumption;
  const atOnce = floorRound(size.requestsPerSecond / requestsPerActiveUserPerSecond);
  return { atOnce, organisation: floorRound(atOnce / activeShare) };
}
