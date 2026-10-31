import { describe, expect, it } from 'vitest';
import { attachBodyOf, attachProblems, attachReady, EMPTY_ATTACH } from './attach-body.ts';

describe('attach dialog rules', () => {
  it('needs only a valid project ID', () => {
    expect(attachReady(EMPTY_ATTACH)).toBe(false);
    expect(attachReady({ ...EMPTY_ATTACH, externalId: 'acme-shop-prod' })).toBe(true);
    expect(attachReady({ ...EMPTY_ATTACH, externalId: 'Acme Shop' })).toBe(false);
  });

  it('flags a service account that is not one', () => {
    const problems = attachProblems({
      ...EMPTY_ATTACH,
      externalId: 'acme-shop-prod',
      deployer: 'deployer@acme.com',
      runtime: 'run@acme-shop-prod.iam.gserviceaccount.com',
    });
    expect([...problems]).toEqual(['deployer']);
  });

  it('leaves out an empty name and sends empty accounts as null', () => {
    expect(attachBodyOf({ ...EMPTY_ATTACH, externalId: ' acme-shop-prod ' })).toEqual({
      externalId: 'acme-shop-prod',
      deployerServiceAccount: null,
      runtimeServiceAccount: null,
    });
    expect(
      attachBodyOf({ ...EMPTY_ATTACH, externalId: 'acme-shop-prod', name: 'Shop', runtime: 'a@b' }),
    ).toMatchObject({ name: 'Shop', runtimeServiceAccount: 'a@b' });
  });
});
