import type { FixtureDelivery } from '@bemmoly/core/testing';
import type { CodeHost } from '@bemmoly/shared';
import type { SignedInApp } from '../boot-harness.ts';

/* The calls the code links integration test makes: Settings and Work as the admin, and
 * deliveries as a code host makes them. */

export interface Link {
  kind: string;
  ref: string;
  state: string | null;
  checks: string | null;
  review: string | null;
}

export function codeLinkCalls(app: () => SignedInApp) {
  const call = async <T = Record<string, unknown>>(
    method: string,
    url: string,
    payload?: unknown,
  ) => {
    const response = await app().inject({
      method: method as 'GET',
      url: `/api/v1${url}`,
      ...(payload !== undefined ? { payload: payload as object } : {}),
    });
    return { status: response.statusCode, body: (response.body ? response.json() : null) as T };
  };

  /** As the host sends it: no cookie, no Origin, the raw signed bytes. */
  const deliver = async (host: CodeHost, delivery: FixtureDelivery) => {
    const response = await app().instance.app.inject({
      method: 'POST',
      url: `/api/v1/code-hosts/${host.id}/webhooks`,
      headers: delivery.headers,
      payload: delivery.body,
    });
    return { status: response.statusCode, body: response.json() as Record<string, unknown> };
  };

  const links = async (key: string) =>
    (await call<{ items: Link[] }>('GET', `/work/issues/${key}/code-links`)).body.items;

  const statusOf = async (key: string) =>
    (await call<{ statusId: string }>('GET', `/work/issues/${key}`)).body.statusId;

  /** Work on, and project DEV with two tasks: DEV-1 and DEV-2. */
  async function seedProject(): Promise<void> {
    await call('POST', '/admin/modules/work/enable', { access: { mode: 'everyone' } });
    const project = await call<{ id: string }>('POST', '/work/projects', {
      key: 'DEV',
      name: 'Developer platform',
    });
    const types = (
      await call<{ items: { id: string; key: string }[] }>('GET', '/work/projects/DEV/issue-types')
    ).body.items;
    for (const title of ['Session store to Postgres', 'Throttle exports']) {
      const created = await call('POST', '/work/issues', {
        projectId: project.body.id,
        typeId: types.find((type) => type.key === 'task')?.id,
        title,
      });
      if (created.status !== 201) throw new Error(JSON.stringify(created.body));
    }
  }

  return { call, deliver, links, statusOf, seedProject };
}
