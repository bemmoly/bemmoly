import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startDocsHarness, type DocsHarness } from '../int-support.ts';
import { createDocsStartSource } from './start.ts';

describe("Docs' start page summary", () => {
  let harness: DocsHarness | null = null;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startDocsHarness();
    if (started.available) harness = started.harness;
    else skipReason = started.reason;
  });

  afterAll(async () => {
    await harness?.stop();
  });

  it('counts reviews asked of the person and lists their recently edited pages', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users } = harness;
    const space = await harness.space('STRT');
    const admin = as(users.admin);
    const member = as(users.member);
    const rfc = await services.pages.create(admin, { spaceId: space.id, title: 'Auth RFC' });
    await services.status.setReviewers(admin, rfc.id, { reviewers: [users.member] });
    await services.status.setStatus(admin, rfc.id, { status: 'in_review' });
    const notes = await services.pages.create(member, { spaceId: space.id, title: 'My notes' });

    const summary = await createDocsStartSource(services.home).summaryForUser(member);
    expect(summary.waiting).toEqual({ count: 1, label: 'page to review' });
    expect(summary.needsYou).toEqual([
      expect.objectContaining({
        id: `page:${rfc.id}`,
        title: 'Auth RFC',
        context: 'Review requested · STRT',
        path: `/docs/p/${rfc.id}`,
      }),
    ]);
    expect(summary.recent?.map((entry) => entry.title)).toContain(notes.title);
  });
});
