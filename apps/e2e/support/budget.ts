import type { Page } from '@playwright/test';
import type { IssueRef, ProjectRef, WorkApi } from './work-api.ts';

/** Tech design §20: board view API with 500 issues, p95, on the 2 vCPU reference VM. */
export const BOARD_VIEW_BUDGET_MS = 80;
/**
 * §20 again: a dropped card is visible in the same frame and the server
 * confirms after. Rendering the frame the drop lands in is the budget; a board
 * that waits for the server, or re-renders all 500 cards, misses it by many
 * frames, so the test allows six 60 Hz frames before calling it a regression.
 */
export const FRAME_MS = 1000 / 60;
export const DROP_TO_PAINT_LIMIT_MS = 6 * FRAME_MS;

export function percentile(samples: readonly number[], p: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? Number.NaN;
}

export const summary = (samples: readonly number[]) => ({
  n: samples.length,
  p50: Number(percentile(samples, 50).toFixed(1)),
  p95: Number(percentile(samples, 95).toFixed(1)),
  max: Number(Math.max(...samples).toFixed(1)),
});

/** Runs `work` over `items` with at most `width` in flight, in order of the items. */
export async function inBatches<T, R>(
  items: readonly T[],
  width: number,
  work: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let start = 0; start < items.length; start += width) {
    const batch = items.slice(start, start + width);
    results.push(...(await Promise.all(batch.map((item, i) => work(item, start + i)))));
  }
  return results;
}

/**
 * 500 issues through the public API, split between two people so neither
 * runs out of their per-person request budget; `moved` of them are taken
 * one step along the workflow so the board has two full columns.
 */
export async function seedBoard(
  people: readonly WorkApi[],
  project: ProjectRef,
  total: number,
  moved: number,
): Promise<IssueRef[]> {
  const [first] = people;
  if (!first) throw new Error('nobody to seed with');
  const typeId = await first.typeId(project.key);
  const issues = await inBatches(
    Array.from({ length: total }, (_, i) => i),
    8,
    (i) =>
      (people[i % people.length] ?? first).createIssue({
        projectId: project.id,
        typeId,
        title: `Budget issue ${i + 1}`,
      }),
  );
  const { items } = await first.call<{ items: { toStatusId: string; toStatusName: string }[] }>(
    'GET',
    `/work/issues/${issues[0]?.key}/transitions`,
  );
  const selected = items.find((item) => item.toStatusName === 'Selected')?.toStatusId;
  if (!selected) throw new Error('no Selected status');
  await inBatches(issues.slice(0, moved), 8, (issue, i) =>
    (people[(i + 1) % people.length] ?? first).call('PATCH', `/work/issues/${issue.key}`, {
      statusId: selected,
    }),
  );
  return issues;
}

/**
 * Milliseconds from the drop event to the first frame painted with the card
 * in its new column, measured in the page so the test runner's own latency
 * is not in the number.
 */
export async function armDropTimer(page: Page, issueId: string, column: string): Promise<void> {
  await page.evaluate(
    ([id, label]) => {
      const win = window as unknown as { dropToPaint?: Promise<number> };
      win.dropToPaint = new Promise<number>((resolve) => {
        const onDrop = () => {
          const dropped = performance.now();
          document.removeEventListener('drop', onDrop, true);
          const landed = () =>
            document.querySelector(`[role="group"][aria-label="${label}"] [data-issue-id="${id}"]`);
          // The frame's callbacks run before it paints; the task after them runs once it has.
          const paint = () =>
            requestAnimationFrame(() => setTimeout(() => resolve(performance.now() - dropped), 0));
          if (landed()) {
            paint();
            return;
          }
          const observer = new MutationObserver(() => {
            if (!landed()) return;
            observer.disconnect();
            paint();
          });
          observer.observe(document.body, { childList: true, subtree: true });
        };
        document.addEventListener('drop', onDrop, true);
        // A card that never lands reads as NaN, which no budget passes.
        setTimeout(() => resolve(Number.NaN), 5000);
      });
    },
    [issueId, column] as const,
  );
}

export const readDropTimer = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { dropToPaint: Promise<number> }).dropToPaint);
