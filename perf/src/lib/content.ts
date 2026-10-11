/*
 * Deterministic content for the sample dataset: issue titles and descriptions, comments and
 * page bodies that read like a product team's, built from a small vocabulary so search and
 * ⌘K queries have real hits. Documents are ProseMirror JSON, the shape Work and Docs store.
 */

export const AREAS = [
  'payments',
  'billing',
  'onboarding',
  'search',
  'notifications',
  'checkout',
  'invoices',
  'exports',
  'permissions',
  'mobile',
  'sync',
  'reports',
  'webhooks',
  'audit',
  'dashboard',
  'calendar',
  'uploads',
  'sessions',
  'pricing',
  'analytics',
] as const;

const VERBS = [
  'Fix',
  'Add',
  'Improve',
  'Refactor',
  'Investigate',
  'Document',
  'Speed up',
  'Remove',
];
const OBJECTS = [
  'retry logic',
  'empty state',
  'error message',
  'pagination',
  'cache',
  'API endpoint',
  'settings page',
  'keyboard shortcut',
  'timeout',
  'loading state',
  'filter',
  'CSV export',
  'date picker',
  'audit trail',
  'permission check',
];
const PAGE_KINDS = ['Runbook', 'Design note', 'Decision record', 'How-to', 'Onboarding guide'];
const SENTENCES = [
  'The current behaviour surprises people who expect the list to keep their place.',
  'We measured the slow path on the reference install and it spends most of its time waiting.',
  'Customers on the larger plans hit this first, usually at the end of the month.',
  'The fix should keep the old links working, because people bookmark them.',
  'Support has a workaround, but it needs an admin and takes several steps.',
  'Done means the state is designed, tested on a phone width and in both themes.',
  'We considered doing this in the background job instead and rejected it for latency.',
  'The change is small, but it touches the permission check, so it needs a second review.',
  'Logs carry the request id, which makes the failure easy to find once it is reported.',
  'A follow-up can remove the flag once every install has run the new changeset.',
];
export const PRIORITIES = ['lowest', 'low', 'medium', 'medium', 'high', 'highest'] as const;

/** mulberry32: a tiny seeded PRNG, so two seeds of the same size make the same dataset. */
export function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const pick = <T>(items: readonly T[], random: () => number): T =>
  items[Math.floor(random() * items.length)] as T;

type Node = { type: string; attrs?: Record<string, unknown>; content?: Node[]; text?: string };

const text = (value: string): Node => ({ type: 'text', text: value });
const paragraph = (value: string): Node => ({ type: 'paragraph', content: [text(value)] });
const heading = (level: number, value: string): Node => ({
  type: 'heading',
  attrs: { level },
  content: [text(value)],
});
const bullets = (items: string[]): Node => ({
  type: 'bulletList',
  content: items.map((item) => ({ type: 'listItem', content: [paragraph(item)] })),
});
const doc = (content: Node[]) => ({ type: 'doc', content });

const sentences = (random: () => number, count: number) =>
  Array.from({ length: count }, () => pick(SENTENCES, random)).join(' ');

export function issueTitle(index: number): string {
  const random = rng(index * 7 + 1);
  return `${pick(VERBS, random)} ${pick(OBJECTS, random)} in ${pick(AREAS, random)}`;
}

export function issueDescription(index: number) {
  const random = rng(index * 13 + 5);
  return doc([
    paragraph(sentences(random, 3)),
    bullets([sentences(random, 1), sentences(random, 1), sentences(random, 1)]),
    paragraph(sentences(random, 2)),
  ]);
}

export function commentBody(index: number) {
  return doc([paragraph(sentences(rng(index * 17 + 3), 2))]);
}

export function pageTitle(space: string, index: number): string {
  const random = rng(index * 31 + space.length);
  return `${pick(PAGE_KINDS, random)}: ${pick(AREAS, random)} ${pick(OBJECTS, random)} ${index}`;
}

/** About 400 words: a heading per section, prose and a list, like a real team page. */
export function pageBody(index: number) {
  const random = rng(index * 37 + 11);
  const sections = ['Context', 'What we do', 'Open questions'];
  return doc(
    sections.flatMap((section) => [
      heading(2, section),
      paragraph(sentences(random, 4)),
      bullets([sentences(random, 1), sentences(random, 1)]),
      paragraph(sentences(random, 3)),
    ]),
  );
}

/** What people type into ⌘K: area names, prefixes of them, and words from titles. */
export function searchTerms(): string[] {
  const prefixes = AREAS.map((area) => area.slice(0, 3));
  const words = OBJECTS.map((object) => object.split(' ')[0] ?? object);
  return [...new Set([...AREAS, ...prefixes, ...words.map((word) => word.toLowerCase())])];
}
