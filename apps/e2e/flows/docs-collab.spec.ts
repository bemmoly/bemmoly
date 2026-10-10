import { arrangePage, docText, openLive, saveLine, settled, typeAt } from '../support/docs.ts';
import { expect, test, uniqueKey } from '../support/fixtures.ts';

const firstName = (name: string) => name.split(' ')[0] ?? name;

/*
 * The 0.3 exit criterion: two browsers edit one page at the same time without conflict.
 * Two people, each in a browser context of their own, type into the same page at once; both
 * see the other on the page, both end with the same document, and it survives a reload.
 */
test('two people edit one page at once and both keep every word', async ({
  page,
  admin,
  pageAs,
  run,
  me,
}) => {
  const section = (name: string) => [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: name }] },
    { type: 'paragraph', content: [{ type: 'text', text: `${name}:` }] },
  ];
  const doc = await arrangePage(admin, uniqueKey('C'), 'Shared incident notes', {
    type: 'doc',
    content: [...section('Actions'), ...section('Findings')],
  });
  const other = run.admins.find((person) => person.id !== me.id) ?? run.member;
  const theirs = await pageAs(other);

  await Promise.all([openLive(page, doc.id), openLive(theirs, doc.id)]);

  // Both find the page marked in their own sidebar's tree, beside the live document.
  for (const side of [page, theirs]) {
    await expect(
      side.getByRole('tree').getByRole('treeitem', { name: 'Shared incident notes' }),
    ).toHaveAttribute('aria-current', 'page');
  }

  // Each sees the other here.
  await expect(saveLine(page)).toContainText(`${firstName(other.name)} is editing`);
  await expect(saveLine(theirs)).toContainText(`${firstName(me.name)} is editing`);

  // Both type at the same moment, each in a section of the page.
  const mine = [' paged the on-call.', ' Rolled back the flag.'];
  const yours = [' error rate peaked at 4%.', ' Redis evicted sessions.'];
  await Promise.all([
    (async () => {
      for (const line of mine) await typeAt(page, line, 0);
    })(),
    (async () => {
      for (const line of yours) await typeAt(theirs, line, 1);
    })(),
  ]);
  await Promise.all([settled(page), settled(theirs)]);

  // They converge: every word from each, and the same document on both sides.
  const actions = `Actions:${mine.join('')}`;
  const findings = `Findings:${yours.join('')}`;
  for (const side of [page, theirs]) {
    await expect.poll(() => docText(side)).toContain(actions);
    await expect.poll(() => docText(side)).toContain(findings);
  }
  await expect.poll(async () => (await docText(page)) === (await docText(theirs))).toBe(true);

  // Each side draws the other person's caret.
  await expect(page.locator(`[data-collab-caret="${other.id}"]`)).toHaveCount(1);
  await expect(theirs.locator(`[data-collab-caret="${me.id}"]`)).toHaveCount(1);

  // It survives a reload, and the person who reloads finds the same document.
  const converged = await docText(theirs);
  await page.reload();
  await expect(saveLine(page)).toHaveAttribute('data-save-state', 'live', { timeout: 20_000 });
  await expect.poll(() => docText(page), { timeout: 15_000 }).toBe(converged);
});
