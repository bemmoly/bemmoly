import { expect, test, uniqueKey } from '../support/fixtures.ts';

// Six columns beside the 240px sidebar: every column is on screen without scrolling sideways.
test.use({ viewport: { width: 1680, height: 900 } });

const PAGE = 50;

test('a long column loads a page at a time, and a change elsewhere patches one card', async ({
  admin,
  run,
  pageAs,
}) => {
  test.setTimeout(120_000);
  const project = await admin.createProject({
    key: uniqueKey('PGN'),
    name: 'Paged board',
    method: 'kanban',
  });
  await admin.addMembers(project.key, [run.member.id]);
  const issues = await admin.createIssues(
    project,
    Array.from({ length: PAGE + 6 }, (_, i) => `Paged issue ${i + 1}`),
  );

  const page = await pageAs(run.member);
  const reads: string[] = [];
  page.on('request', (request) => {
    if (/\/api\/v1\/work\/boards\/[^/]+\/view/.test(request.url())) reads.push(request.url());
  });
  await page.goto(`/work/board/${project.key}`);
  const column = (name: string) => page.getByRole('group', { name: `${name}, All issues` });
  const backlog = column('Backlog');
  const cards = backlog.locator('[data-issue-id]');
  await expect(cards.first()).toBeVisible();

  // The first page, then the rest from the foot of the column; the count is every card.
  const more = page.getByRole('button', { name: 'Show 6 more in Backlog' });
  await more.scrollIntoViewIfNeeded();
  await expect(cards).toHaveCount(PAGE + 6, { timeout: 15_000 });
  await expect(more).toHaveCount(0);
  expect(reads.some((url) => new URL(url).searchParams.get('column') !== null)).toBe(true);

  // Someone else moves one card: this board reads that card alone, not the whole board.
  const moved = issues[0];
  if (!moved) throw new Error('no issue');
  const { items } = await admin.call<{ items: { toStatusId: string; toStatusName: string }[] }>(
    'GET',
    `/work/issues/${moved.key}/transitions`,
  );
  const selected = items.find((item) => item.toStatusName === 'Selected')?.toStatusId;
  if (!selected) throw new Error('no Selected status');
  reads.length = 0;
  await admin.call('PATCH', `/work/issues/${moved.key}`, { statusId: selected });
  await expect(
    column('Selected').getByRole('button', { name: new RegExp(`^${moved.key} `) }),
  ).toBeVisible();
  await expect(cards).toHaveCount(PAGE + 5);
  expect(reads.length).toBeGreaterThan(0);
  expect(reads.every((url) => new URL(url).searchParams.get('issueIds') !== null)).toBe(true);
});
