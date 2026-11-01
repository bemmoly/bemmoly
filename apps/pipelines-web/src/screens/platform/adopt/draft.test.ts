import type { AdoptionPlan, CopyPlan } from '@bemmoly/module-pipelines/shared';
import { describe, expect, it } from 'vitest';
import { adoptBodyOf, adoptDraftOf, copyBodyOf, copyDraftOf } from './draft.ts';

const env = (key: string, cls: 'staging' | 'prod') => ({ id: key, key, name: key, class: cls });

const adoption: AdoptionPlan = {
  environment: env('staging', 'staging'),
  project: 'acme-stage',
  region: 'europe-west1',
  applications: [{ key: 'cart-api', name: 'Cart' }],
  services: [
    {
      service: 'checkout-api',
      url: null,
      application: { key: 'checkout-api', name: 'Checkout' },
      state: 'ready',
      image: 'r@sha256:1',
      revision: 'r1',
      settings: [],
      problem: null,
      variables: [
        {
          name: 'CART_URL',
          kind: 'plain',
          value: 'https://cart/v2',
          reference: { application: 'cart-api', value: '${{ apps.cart-api.url }}/v2' },
        },
      ],
    },
    {
      service: 'cart-svc',
      url: null,
      application: null,
      state: 'unmatched',
      image: 'r@sha256:2',
      revision: 'r2',
      settings: [],
      problem: null,
      variables: [],
    },
    {
      service: 'search-api',
      url: null,
      application: { key: 'search-api', name: 'Search' },
      state: 'adopted',
      image: 'r@sha256:3',
      revision: 'r3',
      settings: [],
      problem: null,
      variables: [],
    },
  ],
};

describe('adopting', () => {
  it('ticks what matches, keeps references, and adds an unmatched one once given an application', () => {
    const draft = adoptDraftOf(adoption);
    expect(adoptBodyOf(adoption, draft)).toEqual({
      services: [
        { service: 'checkout-api', application: 'checkout-api', references: ['CART_URL'] },
      ],
    });
    const chosen = {
      ...draft,
      'cart-svc': { adopt: true, application: 'cart-api', references: new Set<string>() },
      'checkout-api': { ...draft['checkout-api']!, references: new Set<string>() },
    };
    expect(adoptBodyOf(adoption, chosen)?.services).toEqual([
      { service: 'checkout-api', application: 'checkout-api', references: [] },
      { service: 'cart-svc', application: 'cart-api', references: [] },
    ]);
    expect(
      adoptBodyOf(adoption, {
        ...draft,
        'checkout-api': { ...draft['checkout-api']!, adopt: false },
      }),
    ).toBeNull();
  });
});

const copy: CopyPlan = {
  from: env('staging', 'staging'),
  to: env('prod', 'prod'),
  secretMode: 'needs-value',
  applications: [
    {
      application: { key: 'cart-api', name: 'Cart' },
      runtime: { from: 'cloud-run', to: 'gke-autopilot' },
      same: 0,
      items: [
        {
          id: 'cart-api:variable:LOG',
          kind: 'variable',
          name: 'LOG',
          before: null,
          after: 'info',
          reference: false,
          ticked: true,
        },
        {
          id: 'cart-api:secret:DB',
          kind: 'secret',
          name: 'DB',
          location: 'p / s',
          mode: 'needs-value',
          ticked: true,
        },
        {
          id: 'cart-api:setting:scaling.min',
          kind: 'setting',
          field: 'scaling.min',
          before: 2,
          after: 0,
          applies: true,
          note: 'keeps-default',
          ticked: false,
        },
        {
          id: 'cart-api:setting:scaling.concurrency',
          kind: 'setting',
          field: 'scaling.concurrency',
          before: null,
          after: 80,
          applies: false,
          note: 'dropped',
          ticked: false,
        },
      ],
    },
  ],
};

describe('copying', () => {
  it('sends the ticked items with each secret’s choice, never a dropped setting', () => {
    const draft = copyDraftOf(copy);
    expect(copyBodyOf(copy, draft)).toEqual({
      from: 'staging',
      items: [{ id: 'cart-api:variable:LOG' }, { id: 'cart-api:secret:DB', secret: 'needs-value' }],
    });
    const changed = {
      ticked: new Set([
        ...draft.ticked,
        'cart-api:setting:scaling.min',
        'cart-api:setting:scaling.concurrency',
      ]),
      modes: new Map([['cart-api:secret:DB', 'copy' as const]]),
    };
    expect(copyBodyOf(copy, changed)?.items).toEqual([
      { id: 'cart-api:variable:LOG' },
      { id: 'cart-api:secret:DB', secret: 'copy' },
      { id: 'cart-api:setting:scaling.min' },
    ]);
    expect(copyBodyOf(copy, { ticked: new Set(), modes: new Map() })).toBeNull();
  });
});
