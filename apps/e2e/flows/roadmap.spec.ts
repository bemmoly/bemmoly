import { AxeBuilder } from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import type { IssueRef } from '../support/work-api.ts';
import { expect, test, uniqueKey } from '../support/fixtures.ts';

/*
 * The roadmap against a real install: an epic in flight with half its work done (so the
 * project has a pace to forecast from) holding up a later one. The forecast reads in words,
 * a bar moves a week from the keyboard and three days by dragging, and every view of it
 * passes axe in both themes. Colour contrast is left to the design system's own checks, as
 * in the Docs accessibility flow.
 */

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const DAY = 86_400_000;
const day = (offset: number) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);

async function expectNoViolations(page: Page, screen: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(WCAG)
    .disableRules(['color-contrast'])
    .analyze();
  const found = violations.map(
    (violation) =>
      `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
  );
  expect(found, `${screen} has accessibility violations`).toEqual([]);
}

interface Detail extends IssueRef {
  startAt: string | null;
  customFields: Record<string, unknown>;
}

test('the roadmap forecasts an epic in words and moves it by keyboard and by drag', async ({
  page,
  admin,
  me,
}) => {
  const project = await admin.createProject({
    key: uniqueKey('RMP'),
    name: 'Roadmap flow',
    method: 'kanban',
  });
  const epicType = await admin.typeId(project.key, 'epic');
  const taskType = await admin.typeId(project.key, 'task');
  const epic = (title: string, start: number, target: number) =>
    admin.call<IssueRef>('POST', '/work/issues', {
      projectId: project.id,
      typeId: epicType,
      title,
      startAt: day(start),
      customFields: { target_date: day(target), owner: me.id },
    });
  const billing = await epic('Billing v2', -7, 28);
  const observability = await epic('Observability', 35, 70);
  await admin.call('POST', `/work/issues/${billing.key}/links`, {
    targetId: observability.id,
    kind: 'blocks',
  });
  const tasks: IssueRef[] = [];
  for (const title of [
    'Webhooks',
    'Invoices',
    'Tax rates',
    'Proration',
    'Credit notes',
    'Receipts',
  ]) {
    tasks.push(
      await admin.call<IssueRef>('POST', '/work/issues', {
        projectId: project.id,
        typeId: taskType,
        title,
        parentId: billing.id,
      }),
    );
  }
  for (const task of tasks.slice(0, 3)) {
    await admin.walk(task.key, ['Selected', 'In progress', 'Code review', 'Testing', 'Done']);
  }

  await page.goto(`/work/roadmap/${project.key}`);
  const bar = (title: string) => page.getByRole('button', { name: new RegExp(`^${title}, `) });
  await expect(bar('Billing v2')).toBeVisible();
  await expect(bar('Observability')).toBeVisible();
  // The project's own Roadmap row is current, not Work's area-wide Roadmap above the projects.
  await expect(
    page
      .getByRole('link', { name: 'Roadmap', exact: true })
      .and(page.locator(`[href$="/work/roadmap/${project.key}"]`)),
  ).toHaveAttribute('aria-current', 'page');

  // The forecast, in words, beside the timeline.
  await page.getByRole('button', { name: /^Billing v2 forecast: / }).click();
  const panel = page.getByRole('complementary', { name: 'Billing v2 forecast' });
  await expect(panel.getByRole('heading', { name: /^Likely / })).toBeVisible();
  await expect(panel.getByText(/Over the last 8 weeks, Roadmap flow finished/)).toBeVisible();
  await expect(panel.getByText('3 of its 6 issues are left.')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Observability' })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`forecast=${billing.id}`));
  await panel.getByRole('button', { name: 'Close' }).click();
  await expect(panel).toBeHidden();

  // A week later from the keyboard: the target moves in the epic's Target date field.
  await bar('Billing v2').focus();
  await page.keyboard.press('Shift+ArrowRight');
  await expect(page.getByText(/^Billing v2 moved to /)).toBeVisible();
  await expect
    .poll(async () => {
      const detail = await admin.call<Detail>('GET', `/work/issues/${billing.key}`);
      return [detail.startAt, detail.customFields['target_date']];
    })
    .toEqual([day(0), day(35)]);

  // Three days later by dragging the waiting epic, six pixels a day at the months zoom.
  const box = await bar('Observability').boundingBox();
  if (!box) throw new Error('no bar to drag');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 9, box.y + box.height / 2, { steps: 3 });
  await page.mouse.move(box.x + box.width / 2 + 18, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect
    .poll(
      async () => (await admin.call<Detail>('GET', `/work/issues/${observability.key}`)).startAt,
    )
    .toBe(day(38));
});

for (const theme of ['light', 'dark'] as const) {
  test(`the roadmap passes axe in the ${theme} theme`, async ({ page, admin, me }) => {
    await page.addInitScript((mode) => {
      localStorage.setItem(
        'bemmoly.theme',
        JSON.stringify({ state: { mode, preset: null }, version: 2 }),
      );
    }, theme);
    const project = await admin.createProject({ key: uniqueKey('RMA'), name: 'Roadmap axe' });
    const epicType = await admin.typeId(project.key, 'epic');
    const epic = await admin.call<IssueRef>('POST', '/work/issues', {
      projectId: project.id,
      typeId: epicType,
      title: 'Search v2',
      startAt: day(-3),
      customFields: { target_date: day(20), owner: me.id },
    });
    await admin.createIssues(project, ['Index pages']);

    await page.goto(`/work/roadmap/${project.key}`);
    await expect(page.getByRole('button', { name: /^Search v2, / })).toBeVisible();
    await expectNoViolations(page, 'project roadmap');

    await page.getByRole('button', { name: /^Search v2 forecast: / }).click();
    await expect(page.getByRole('complementary', { name: 'Search v2 forecast' })).toBeVisible();
    await expectNoViolations(page, 'forecast panel');

    await page.goto(`/work/roadmap?group=team`);
    await expect(page.getByRole('list', { name: 'Roadmap' })).toBeVisible();
    await expectNoViolations(page, 'every project’s roadmap');
    expect(epic.key).toMatch(/^RMA/);
  });
}
