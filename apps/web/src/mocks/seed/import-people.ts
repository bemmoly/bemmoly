import type { ImportPersonRow, User } from '@bemmoly/shared';

/**
 * The people a connection's chosen containers name. The everyday Jira site names 86: 61 with
 * a member's email, 19 with an address no member has (placeholders) and 6 whose email Jira
 * hides. Confluence names 24 (18, 4, 2); a CSV file names nobody.
 */
const FIRST = ['Ana', 'Rohan', 'Mei', 'Jonas', 'Priya', 'Tom', 'Sara', 'Liam', 'Aisha', 'Kenji'];
const LAST = ['Costa', 'Shah', 'Lin', 'Berg', 'Nair', 'Okafor', 'Ruiz', 'Chen', 'Watanabe'];

const SPLITS: Record<string, [number, number, number]> = {
  jira: [61, 19, 6],
  confluence: [18, 4, 2],
};

function nameOf(i: number) {
  return `${FIRST[i % FIRST.length] ?? 'Ana'} ${LAST[Math.floor(i / FIRST.length) % LAST.length] ?? 'Costa'}`;
}

export function mockImportPeople(source: string, users: readonly User[]): ImportPersonRow[] {
  const [matched, placeholders, hidden] = SPLITS[source] ?? [0, 0, 0];
  const active = users.filter((user) => user.status === 'active');
  const rows: ImportPersonRow[] = [];
  for (let i = 0; i < matched + placeholders + hidden; i += 1) {
    const name = nameOf(i);
    const handle = name.toLowerCase().replace(' ', '.');
    const member = i < matched ? active[i % Math.max(1, active.length)] : undefined;
    const match = i < matched ? 'matched' : i < matched + placeholders ? 'placeholder' : 'hidden';
    rows.push({
      sourceId: `acct-${String(i + 1).padStart(3, '0')}`,
      name: match === 'hidden' ? `${name.charAt(0)}. ${name.split(' ')[1] ?? ''}` : name,
      email: match === 'hidden' ? null : `${handle}${i}@acmelabs.dev`,
      match,
      userId: member?.id ?? null,
      userName: member?.name ?? null,
      override: false,
    });
  }
  return rows;
}

const RANK = { hidden: 0, placeholder: 1, matched: 2 } as const;

/** Hidden and placeholders first (what may need a hand), then by name, as the server lists. */
export const byNeed = (a: ImportPersonRow, b: ImportPersonRow) =>
  RANK[a.match] - RANK[b.match] ||
  a.name.localeCompare(b.name) ||
  a.sourceId.localeCompare(b.sourceId);
