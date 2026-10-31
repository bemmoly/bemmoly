import { describe, expect, it } from 'vitest';
import {
  createCustomFieldBodySchema,
  updateCustomFieldBodySchema,
  type CustomFieldKind,
} from './definitions.ts';
import { formLayoutSchema, visibleFieldKeys } from './forms.ts';
import { validateFieldValues, type FieldRules } from './values.ts';

const field = (
  key: string,
  kind: CustomFieldKind,
  extra: Partial<FieldRules> = {},
): FieldRules => ({
  key,
  label: key,
  kind,
  required: false,
  options: [],
  validation: {},
  ...extra,
});

const options = [
  { value: 'laptop', label: 'Laptop' },
  { value: 'phone', label: 'Phone' },
];

describe('validateFieldValues', () => {
  it('accepts one good value of every kind', () => {
    const fields = [
      field('t', 'text'),
      field('l', 'long_text'),
      field('n', 'number'),
      field('m', 'money'),
      field('d', 'date'),
      field('s', 'select', { options }),
      field('ms', 'multi_select', { options }),
      field('p', 'person'),
      field('b', 'boolean'),
      field('f', 'file'),
    ];
    const id = '0199c7a0-0000-7000-8000-000000000001';
    const result = validateFieldValues(
      fields,
      {
        t: ' Hi ',
        l: 'Long',
        n: 2.5,
        m: { amountMinor: 1999, currency: 'EUR' },
        d: '2026-10-22',
        s: 'phone',
        ms: ['phone', 'phone', 'laptop'],
        p: id,
        b: false,
        f: id,
      },
      { mode: 'create' },
    );
    expect(result).toEqual({
      ok: true,
      values: expect.objectContaining({ t: 'Hi', ms: ['phone', 'laptop'], b: false }),
    });
  });

  it('names every bad value and unknown key with what to do', () => {
    const fields = [
      field('n', 'number', { validation: { max: 10, decimals: 0 } }),
      field('s', 'select', { options }),
      field('code', 'text', { validation: { pattern: '[A-Z]{3}' } }),
      field('m', 'money', { validation: { currency: 'USD' } }),
    ];
    const result = validateFieldValues(
      fields,
      { n: 1.5, s: 'tablet', code: 'abc', m: { amountMinor: 1, currency: 'EUR' }, zzz: 1 },
      { mode: 'update' },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.fromEntries(result.issues.map((i) => [i.key, i.message]))).toEqual({
      zzz: 'There is no such field',
      n: 'Use a whole number',
      s: 'Pick one of the options',
      code: 'Use the expected format',
      m: 'Use USD',
    });
  });

  it('requires on create, fills defaults, and checks only given keys on update', () => {
    const fields = [field('a', 'text', { required: true }), field('b', 'number')];
    expect(validateFieldValues(fields, {}, { mode: 'create' })).toEqual({
      ok: false,
      issues: [{ key: 'a', message: 'a is required' }],
    });
    expect(
      validateFieldValues(fields, {}, { mode: 'create', defaults: new Map([['a', 'x']]) }),
    ).toEqual({ ok: true, values: { a: 'x' } });
    expect(validateFieldValues(fields, { b: null }, { mode: 'update' })).toEqual({
      ok: true,
      values: { b: null },
    });
    expect(validateFieldValues(fields, { a: '' }, { mode: 'update' }).ok).toBe(false);
  });
});

describe('definitions', () => {
  it('refuses a select without options and a pattern that does not compile', () => {
    const base = { moduleId: 'people', entityType: 'person', key: 'kit', label: 'Kit' };
    expect(createCustomFieldBodySchema.safeParse({ ...base, kind: 'select' }).success).toBe(false);
    expect(
      createCustomFieldBodySchema.safeParse({
        ...base,
        kind: 'text',
        validation: { pattern: '(' },
      }).success,
    ).toBe(false);
    expect(createCustomFieldBodySchema.parse({ ...base, kind: 'boolean' }).required).toBe(false);
  });

  it('refuses patterns that could backtrack for minutes, on create and update', () => {
    const base = {
      moduleId: 'people',
      entityType: 'person',
      key: 'kit',
      label: 'Kit',
      kind: 'text',
    };
    for (const pattern of [
      '(a+)+',
      '(a|ab)*',
      '((ab)*c)+',
      '(x)\\1',
      '(?<n>a)\\k<n>',
      'a*a*a*a*b',
      '(a|a)(a|a)(a|a)(a|a)',
      'a?a?a?a?aaaa',
      '(?:a{1,9}){2,}',
      'a)|(b',
      '(a',
      '(?:a{9}){9}',
      'a{201}',
      '(?:(?=a)){5}',
    ]) {
      expect(
        createCustomFieldBodySchema.safeParse({ ...base, validation: { pattern } }).success,
      ).toBe(false);
      expect(updateCustomFieldBodySchema.safeParse({ validation: { pattern } }).success).toBe(
        false,
      );
    }
    for (const pattern of [
      '[A-Z]{3}-\\d+',
      '(ab)?c*',
      '(a|b)c',
      '[(+)]+',
      'a+b*',
      '(?:ab){2}\\d{4}',
    ]) {
      expect(
        createCustomFieldBodySchema.safeParse({ ...base, validation: { pattern } }).success,
      ).toBe(true);
    }
  });

  it('caps text under a pattern so the slowest allowed one stays quick', () => {
    const fields = [field('code', 'text', { validation: { pattern: 'a*a*a*b' } })];
    const started = Date.now();
    const short = validateFieldValues(fields, { code: 'a'.repeat(200) }, { mode: 'create' });
    expect(Date.now() - started).toBeLessThan(500);
    expect(short.ok).toBe(false);
    const long = validateFieldValues(fields, { code: `${'a'.repeat(200)}b` }, { mode: 'create' });
    expect(long).toMatchObject({ ok: false });
  });

  it('checks a value against an unsafe stored pattern without running it', () => {
    const started = Date.now();
    validateFieldValues(
      [field('code', 'text', { validation: { pattern: '(a+)+$' } })],
      {
        code: `${'a'.repeat(40)}!`,
      },
      { mode: 'create' },
    );
    expect(Date.now() - started).toBeLessThan(500);
  });
});

describe('visibleFieldKeys', () => {
  const layout = formLayoutSchema.parse([
    {
      id: 'main',
      items: [
        { field: 'kind' },
        { field: 'laptop_model', when: [{ field: 'kind', operator: 'equals', value: 'laptop' }] },
        { field: 'reason', when: [{ field: 'laptop_model', operator: 'is_set' }] },
      ],
    },
    {
      id: 'extra',
      when: [{ field: 'kind', operator: 'in', value: ['phone'] }],
      items: [{ field: 'carrier' }],
    },
  ]);

  it('shows items and sections whose conditions hold', () => {
    expect([...visibleFieldKeys(layout, { kind: 'phone' })]).toEqual(['kind', 'carrier']);
    expect([...visibleFieldKeys(layout, { kind: 'laptop', laptop_model: 'x' })]).toEqual([
      'kind',
      'laptop_model',
      'reason',
    ]);
  });

  it('treats a hidden field as empty for what depends on it', () => {
    expect([...visibleFieldKeys(layout, { kind: 'phone', laptop_model: 'stale' })]).toEqual([
      'kind',
      'carrier',
    ]);
  });

  it('refuses a field placed twice', () => {
    expect(
      formLayoutSchema.safeParse([{ id: 'a', items: [{ field: 'x' }, { field: 'x' }] }]).success,
    ).toBe(false);
  });
});
