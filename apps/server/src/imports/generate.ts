/*
 * A large fake Jira project for the performance run: issues numbered 1..n in project OPS with
 * the fixture site's types and statuses, an ADF description, two embedded comments, labels,
 * a sprint, story points, an epic parent every 50 issues and a link to the previous issue.
 * Deterministic, so two runs import the same data.
 */

const STATUSES = [
  { id: '10', name: 'To Do', statusCategory: { key: 'new' } },
  { id: '11', name: 'In Progress', statusCategory: { key: 'indeterminate' } },
  { id: '12', name: 'In Review', statusCategory: { key: 'indeterminate' } },
  { id: '13', name: 'Done', statusCategory: { key: 'done' } },
];
const PEOPLE = Array.from({ length: 40 }, (_, index) => ({
  accountId: `acc-gen-${index}`,
  emailAddress: `person${index}@example.test`,
  displayName: `Person ${index}`,
}));
const LABELS = ['payments', 'web', 'mobile', 'infra', 'security', 'billing', 'search', 'growth'];

const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });

export function generateIssues(count: number): unknown[] {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const epic = number % 50 === 1;
    const person = PEOPLE[number % PEOPLE.length]!;
    return {
      id: String(100_000 + number),
      key: `OPS-${number}`,
      fields: {
        summary: `${epic ? 'Epic' : 'Work item'} ${number}: make the thing ${number % 7 ? 'faster' : 'safer'}`,
        issuetype: epic
          ? { id: '1', name: 'Epic', hierarchyLevel: 1 }
          : { id: '2', name: 'Story', hierarchyLevel: 0 },
        status: STATUSES[number % STATUSES.length],
        priority: { name: ['Highest', 'High', 'Medium', 'Low'][number % 4] },
        assignee: number % 5 ? person : null,
        reporter: PEOPLE[(number * 7) % PEOPLE.length],
        parent: epic
          ? null
          : {
              id: String(100_000 + number - ((number - 1) % 50)),
              key: `OPS-${number - ((number - 1) % 50)}`,
            },
        labels: [LABELS[number % LABELS.length], LABELS[(number * 3) % LABELS.length]],
        created: new Date(Date.UTC(2025, 0, 1) + number * 3_600_000).toISOString(),
        updated: new Date(Date.UTC(2025, 6, 1) + number * 3_600_000).toISOString(),
        description: {
          type: 'doc',
          version: 1,
          content: [
            paragraph(`As a customer I want item ${number} so that the release goes out on time.`),
            {
              type: 'bulletList',
              content: [1, 2, 3].map((step) => ({
                type: 'listItem',
                content: [paragraph(`Step ${step} of ${number}`)],
              })),
            },
          ],
        },
        customfield_10016: (number % 8) + 1,
        customfield_10020: [{ id: number % 3 ? 6 : 5, state: number % 3 ? 'active' : 'closed' }],
        customfield_10050: { value: ['Gold', 'Silver', 'Bronze'][number % 3] },
        comment: {
          total: 2,
          comments: [1, 2].map((n) => ({
            id: `gen-c-${number}-${n}`,
            author: PEOPLE[(number + n) % PEOPLE.length],
            created: new Date(Date.UTC(2025, 1, 1) + number * 3_600_000 + n).toISOString(),
            body: { type: 'doc', version: 1, content: [paragraph(`Comment ${n} on ${number}`)] },
          })),
        },
        attachment: [],
        issuelinks:
          number > 1
            ? [
                {
                  id: `gen-l-${number}`,
                  type: { name: 'Relates' },
                  outwardIssue: { id: String(100_000 + number - 1), key: `OPS-${number - 1}` },
                },
              ]
            : [],
      },
    };
  });
}

const WORDS = ['Atlas', 'Beacon', 'Cobalt', 'Delta', 'Ember', 'Fjord', 'Granite', 'Harbor'];
const AREAS = ['billing', 'checkout', 'onboarding', 'search', 'payments', 'mobile', 'identity'];
const TYPES = ['software', 'business', 'service_desk'];

/**
 * A site with `count` projects for the chooser: keys G1..Gn, a type and lead each, an issue
 * total per key, and every 97th project visible but not browsable by the token.
 */
export function generateProjects(count: number) {
  const projects = Array.from({ length: count }, (_, index) => ({
    id: String(50_000 + index),
    key: `G${index + 1}`,
    name: `${WORDS[index % WORDS.length]} ${AREAS[Math.floor(index / WORDS.length) % AREAS.length]} ${index + 1}`,
    projectTypeKey: TYPES[index % TYPES.length],
    style: 'classic',
    lead: PEOPLE[index % PEOPLE.length],
  }));
  const issueCounts = Object.fromEntries(
    projects.map((project, index) => [project.key, (index * 37) % 400]),
  );
  const unbrowsable = new Set(projects.filter((_, index) => index % 97 === 5).map((p) => p.id));
  return { projects, issueCounts, unbrowsable };
}
