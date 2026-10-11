import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startDocsHarness, type DocsHarness } from '../int-support.ts';

describe('the Docs home needs-attention list', () => {
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

  it('lists reviews asked of the person, then their stale published pages', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users, sql } = harness;
    const space = await harness.space('ATTN');
    const admin = as(users.admin);
    const member = as(users.member);
    const rfc = await services.pages.create(admin, { spaceId: space.id, title: 'Auth RFC' });
    await services.status.setReviewers(admin, rfc.id, { reviewers: [users.member] });
    await services.status.setStatus(admin, rfc.id, { status: 'in_review' });
    const old = await services.pages.create(member, { spaceId: space.id, title: 'On-call' });
    await services.pages.update(member, old.id, { ownerId: users.member });
    await services.status.setStatus(admin, old.id, { status: 'published' });
    const fresh = await services.pages.create(member, { spaceId: space.id, title: 'Fresh' });
    await services.status.setStatus(admin, fresh.id, { status: 'published' });
    await sql`update pages set content_updated_at = now() - interval '200 days'
      where id = ${old.id}`;

    const mine = await services.home.attention(member, { limit: 10 });
    expect(mine.items.map((item) => [item.kind, item.page.title])).toEqual([
      ['review', 'Auth RFC'],
      ['stale', 'On-call'],
    ]);
    expect(mine.staleAfterDays).toBe(90);

    const theirs = await services.home.attention(admin, { limit: 10 });
    expect(theirs.items.map((item) => item.page.id)).not.toContain(rfc.id);

    await services.pages.remove(member, old.id);
    const after = await services.home.attention(member, { limit: 10 });
    expect(after.items.map((item) => item.kind)).toEqual(['review']);
    expect((await services.home.attention(as(users.outsider), { limit: 10 })).items).toEqual([]);
  });
});
