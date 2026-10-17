import type { ImportContainerPage, ImportJob } from '@bemmoly/shared';
import type { SignedInApp } from '../boot-harness.ts';
import { FIXTURE_EMAIL, FIXTURE_TOKEN, type FakeSite } from './fake-atlassian.ts';

/*
 * The calls Settings › Import makes, for the integration and performance tests: connect,
 * pick, run, and wait for the job the queue runs to settle.
 */

export interface CallResult<T = Record<string, unknown>> {
  status: number;
  body: T;
}

export function importCalls(app: SignedInApp) {
  const call = async <T = Record<string, unknown>>(
    method: string,
    url: string,
    payload?: unknown,
  ): Promise<CallResult<T>> => {
    const response = await app.inject({
      method: method as 'GET',
      url: `/api/v1${url}`,
      ...(payload !== undefined ? { payload: payload as object } : {}),
    });
    return { status: response.statusCode, body: (response.body ? response.json() : null) as T };
  };

  /** Polls the job until it leaves queued and running, as the progress bar does. */
  async function settle(id: string, timeoutMs = 120_000): Promise<ImportJob> {
    const until = Date.now() + timeoutMs;
    for (;;) {
      const { body } = await call<ImportJob>('GET', `/admin/imports/${id}`);
      if (body.status !== 'queued' && body.status !== 'running') return body;
      if (Date.now() > until) throw new Error(`Import ${id} is still ${body.status}`);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  return {
    call,
    settle,
    /** Connects to a fake site as an admin would fill the form. */
    connect: (source: string, site: FakeSite, deployment: 'cloud' | 'datacenter' = 'cloud') =>
      call<ImportJob>('POST', '/admin/imports', {
        source,
        values: {
          deployment,
          url: site.url,
          ...(deployment === 'cloud' ? { email: FIXTURE_EMAIL } : {}),
          token: FIXTURE_TOKEN,
        },
      }),
    /** One page of what the connection found, as the chooser lists it. */
    containers: (id: string, query = '') =>
      call<ImportContainerPage>(
        'GET',
        `/admin/imports/${id}/containers${query ? `?${query}` : ''}`,
      ),
    pick: (id: string, containers: string[]) =>
      call<ImportJob>('PATCH', `/admin/imports/${id}`, { containers }),
    run: async (id: string) => {
      const started = await call<ImportJob>('POST', `/admin/imports/${id}/run`);
      if (started.status !== 200) throw new Error(`run refused: ${JSON.stringify(started.body)}`);
      return settle(id);
    },
  };
}
