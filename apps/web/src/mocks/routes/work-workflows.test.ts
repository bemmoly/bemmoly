import { describe, expect, it } from 'vitest';
import { createMockApi } from '../dispatch.ts';
import { WORK_IDS } from '../seed/work-settings.ts';

/* The workflow list the Workflows screen and the Board both read from the mock. */

const W = 'http://mock.local/api/v1/work/workflows';

const ids = (api: ReturnType<typeof createMockApi>, query: string) =>
  (api.dispatch('GET', `${W}${query}`, undefined)?.body as { items: Array<{ id: string }> }).items
    .map((row) => row.id)
    .sort();

describe('the workflows mock', () => {
  it('lists every workflow without a project and the one a board maps with one', () => {
    const api = createMockApi('ready');
    expect(ids(api, '')).toEqual([WORK_IDS.orgWorkflow, WORK_IDS.workflow].sort());
    expect(ids(api, `?projectId=${WORK_IDS.project}`)).toEqual([WORK_IDS.workflow]);
  });
});
