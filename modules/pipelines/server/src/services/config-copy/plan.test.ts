import { describe, expect, it } from 'vitest';
import { planApplication } from './plan.ts';
import type { CopyApplicationState, CopyEnvironment, CopyVariableRow } from './read.ts';

/* The copy plan: only what differs, secrets per target class, settings per target runtime. */

const env = (key: string, cls: 'staging' | 'prod'): CopyEnvironment => ({
  id: key,
  key,
  name: key,
  class: cls,
  protected: cls === 'prod',
});

const plain = (name: string, value: string): CopyVariableRow => ({
  name,
  kind: 'plain',
  value,
  secret_ref: null,
  secret_account_id: null,
  version: 1,
  account: null,
});

const secret = (name: string): CopyVariableRow => ({
  name,
  kind: 'secret',
  value: null,
  secret_ref: `bemmoly-cart-api-${name}-staging`,
  secret_account_id: 'a1',
  version: 2,
  account: 'acme-stage',
});

const app = (to: Partial<CopyApplicationState['to']> = {}): CopyApplicationState => ({
  id: 'app',
  key: 'cart-api',
  name: 'Cart',
  resolvedConfig: { deploy: { port: 8080 } },
  from: {
    runtime: 'cloud-run',
    variables: [
      plain('LOG_LEVEL', 'info'),
      plain('CATALOG_URL', '${{ apps.catalog.url }}/v1'),
      secret('DB_PASSWORD'),
    ],
    settings: { scaling: { min: 0, max: 5, concurrency: 80 }, port: 8080 },
  },
  to: { runtime: 'gke-autopilot', variables: [], settings: {}, ...to },
});

describe('a copy from Stage on Cloud Run to Prod on GKE', () => {
  it('shows each item that differs, with Prod keeping its own minimum', () => {
    const plan = planApplication(app(), env('prod', 'prod'));
    expect(plan.runtime).toEqual({ from: 'cloud-run', to: 'gke-autopilot' });
    const by = (id: string) => plan.items.find((item) => item.id === `cart-api:${id}`);
    expect(by('variable:CATALOG_URL')).toMatchObject({
      reference: true,
      before: null,
      ticked: true,
    });
    expect(by('secret:DB_PASSWORD')).toMatchObject({
      location: 'acme-stage / bemmoly-cart-api-DB_PASSWORD-staging',
      mode: 'needs-value',
    });
    expect(by('setting:scaling.min')).toMatchObject({
      before: 2,
      after: 0,
      note: 'keeps-default',
      ticked: false,
    });
    expect(by('setting:scaling.max')).toMatchObject({ before: 10, after: 5, ticked: true });
    expect(by('setting:scaling.concurrency')).toMatchObject({
      applies: false,
      note: 'dropped',
      ticked: false,
    });
    // The file sets the same port, so copying it would change nothing.
    expect(by('setting:port')).toBeUndefined();
    expect(plan.same).toBe(1);
  });

  it('copies secrets store to store by default when the target is not Prod', () => {
    const plan = planApplication(app({ runtime: 'cloud-run' }), env('qa', 'staging'));
    expect(plan.items.find((item) => item.kind === 'secret')).toMatchObject({ mode: 'copy' });
    expect(plan.items.find((item) => item.id.endsWith('scaling.concurrency'))).toMatchObject({
      applies: true,
      ticked: true,
    });
  });

  it('shows nothing more once the target has what the source has', () => {
    const plan = planApplication(
      app({
        variables: [
          plain('LOG_LEVEL', 'info'),
          plain('CATALOG_URL', '${{ apps.catalog.url }}/v1'),
          { ...secret('DB_PASSWORD'), secret_ref: null },
        ],
        settings: { scaling: { max: 5 } },
      }),
      env('prod', 'prod'),
    );
    expect(plan.items.filter((item) => item.ticked)).toEqual([]);
    expect(plan.same).toBe(5);
  });
});
