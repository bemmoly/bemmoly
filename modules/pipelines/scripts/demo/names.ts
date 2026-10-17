import acme from './acme.json' with { type: 'json' };

/*
 * Acme, the fictional company of the product design. acme.json holds its domains and groups
 * with their application counts (1,140 in 9 domains), the teams that own each group and the
 * words generated application keys start with. Name lists are space-separated strings so
 * the data stays readable at a glance.
 */

export interface GroupSpec {
  key: string;
  name: string;
  count: number;
  /** Teams that own its applications, the first most often. */
  teams: string[];
  /** First halves of generated application keys. */
  words: string[];
}

export interface DomainSpec {
  key: string;
  name: string;
  color: string;
  groups: GroupSpec[];
}

export const DOMAINS: readonly DomainSpec[] = acme.map((domain) => ({
  ...domain,
  groups: domain.groups.map((group) => ({
    ...group,
    teams: group.teams.split('|'),
    words: group.words.split(' '),
  })),
}));

const words = (text: string) => text.trim().split(/\s+/);

/** Teams that own no applications: approvers, auditors and the organisation-wide one. */
export const NON_OWNING_TEAMS: readonly string[] = [
  'Commerce release managers',
  'Finance release managers',
  'Security',
  'All engineering',
  'QA',
  'Architecture',
  'Mobile',
];

/** Every team the seed creates: owners named by the groups, then the rest, 54 in all. */
export function teamNames(): string[] {
  const owners = new Set<string>(['SRE', 'Platform', 'Data platform', 'Identity', 'Media']);
  for (const domain of DOMAINS) {
    for (const group of domain.groups) for (const team of group.teams) owners.add(team);
  }
  return [...owners, ...NON_OWNING_TEAMS];
}

export const SUFFIXES = words(`api worker svc web jobs sync gateway consumer scheduler indexer
  cache events reports ui bff cron`);

export const FIRST_NAMES = words(`Aarav Aditi Akash Amit Ana Anil Anjali Arjun Asha Bhavna
  Carlos Chen Deepa Dev Divya Elena Farah Gaurav Hana Imran Isha Jon Kavya Kiran Lakshmi Lin
  Maya Meera Mohan Nadia Neha Nikhil Omar Pooja Priya Rahul Raj Ravi Riya Rohan Sahil Sana Sara
  Shreya Sneha Suresh Tara Uma Varun Vikram Wei Yusuf Zara Kenji Lucia Mateo Noor Oscar Rina
  Tomas`);

export const LAST_NAMES = words(`Sharma Ruiz Mathew Tan Kumar Iyer Nair Reddy Gupta Patel Singh
  Rao Menon Das Bose Khan Fernandes Pillai Joshi Chopra Mehta Verma Kapoor Agarwal Banerjee
  Ghosh Shah Malhotra Bhatt Wong Lee Silva Costa Okafor Haddad Novak Sato Kim Garcia`);

/** Verbs and objects for commit messages and pull request titles, in sentence case. */
export const COMMIT_VERBS = [
  'Add',
  'Fix',
  'Retry',
  'Cache',
  'Remove',
  'Speed up',
  'Log',
  'Validate',
  'Rename',
  'Handle',
  'Split',
  'Guard',
  'Batch',
  'Index',
] as const;

export const COMMIT_OBJECTS = [
  'timeouts on the gateway call',
  'the empty state',
  'idempotency keys',
  'tax rules per region',
  'stale cache entries',
  'the retry budget',
  'pagination on the list endpoint',
  'duplicate webhook deliveries',
  'the health check',
  'slow queries on orders',
  'missing translations',
  'the feature flag',
  'null addresses',
  'the nightly job',
  'metrics labels',
  'the client timeout',
  'error messages',
  'the rate limiter',
  'unused dependencies',
] as const;
