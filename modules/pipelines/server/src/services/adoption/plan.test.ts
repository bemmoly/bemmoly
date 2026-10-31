import { describe, expect, it } from 'vitest';
import type { RunningService } from '../providers/contract.ts';
import { planServices, referenceFor } from './plan.ts';

/* The adoption plan: matching by name, offering references, and saying what stops one. */

const service = (name: string, overrides: Partial<RunningService> = {}): RunningService => ({
  name,
  urls: [`https://${name}-q4m2.a.run.app`],
  revision: `${name}-00001-abc`,
  image: { repository: `r/${name}`, digest: `sha256:${'1'.repeat(64)}` },
  variables: [],
  settings: {},
  ...overrides,
});

const catalog = [
  { id: 'c1', key: 'cart-api', name: 'Cart' },
  { id: 'c2', key: 'checkout-api', name: 'Checkout' },
];

describe('references to another service', () => {
  const addresses = [{ url: 'https://cart-api-q4m2.a.run.app', application: 'cart-api' }];

  it('swap the address for a reference and keep the rest of the value', () => {
    expect(
      referenceFor('https://cart-api-q4m2.a.run.app/v2?x=1', 'checkout-api', addresses),
    ).toEqual({ application: 'cart-api', value: '${{ apps.cart-api.url }}/v2?x=1' });
    expect(referenceFor('https://cart-api-q4m2.a.run.app', 'checkout-api', addresses)?.value).toBe(
      '${{ apps.cart-api.url }}',
    );
  });

  it('leave a longer host, its own address and other values alone', () => {
    expect(referenceFor('https://cart-api-q4m2.a.run.appx', 'checkout-api', addresses)).toBeNull();
    expect(referenceFor('https://cart-api-q4m2.a.run.app/v2', 'cart-api', addresses)).toBeNull();
    expect(referenceFor('info', 'checkout-api', addresses)).toBeNull();
  });
});

describe('the plan', () => {
  it('matches by name, offers references, and says what stops a service', () => {
    const planned = planServices({
      running: [
        service('cart-api', {
          settings: { 'scaling.min': 0, port: 8080, 'resources.cpu': 'lots' },
        }),
        service('checkout-api', {
          image: null,
          variables: [
            { name: 'CART_URL', kind: 'plain', value: 'https://cart-api-q4m2.a.run.app/v2' },
            { name: 'lower_case', kind: 'plain', value: 'skipped' },
            { name: 'KEY', kind: 'secret', account: 'elsewhere', secret: 'key', version: '4' },
          ],
        }),
        service('nightly-report'),
      ],
      catalog,
      states: new Map([['c1', 'adopted']]),
      accounts: new Map([['acme-stage', 'a1']]),
    });
    expect(planned.map((p) => [p.view.service, p.view.state])).toEqual([
      ['cart-api', 'adopted'],
      ['checkout-api', 'ready'],
      ['nightly-report', 'unmatched'],
    ]);
    expect(planned[0]?.view.settings).toEqual([
      { field: 'scaling.min', value: 0 },
      { field: 'port', value: 8080 },
    ]);
    const checkout = planned[1]?.view;
    expect(checkout?.problem).toMatch(/^Pipelines cannot tell which image checkout-api runs/);
    expect(checkout?.variables).toEqual([
      {
        name: 'CART_URL',
        kind: 'plain',
        value: 'https://cart-api-q4m2.a.run.app/v2',
        reference: { application: 'cart-api', value: '${{ apps.cart-api.url }}/v2' },
      },
      {
        name: 'KEY',
        kind: 'secret',
        location: 'elsewhere / key',
        version: '4',
        problem:
          'KEY lives in elsewhere, which Pipelines has not attached. Attach it in Platform › Clouds, then adopt checkout-api',
      },
    ]);
  });

  it('follows the application chosen for a service', () => {
    const [planned] = planServices({
      running: [service('cart-svc')],
      catalog,
      states: new Map(),
      accounts: new Map(),
      chosen: new Map([['cart-svc', 'cart-api']]),
    });
    expect(planned?.view).toMatchObject({ application: { key: 'cart-api' }, state: 'ready' });
  });
});
