import { describe, expect, it } from 'vitest';
import { changeRequestNumberSchema, createChangeRequestBodySchema } from './change-requests.ts';
import { createEnvironmentV2BodySchema, reorderEnvironmentsBodySchema } from './environments-v2.ts';
import { savePipelineSetupBodySchema } from './pipeline-setup.ts';
import { ROLE_PLACES } from './roles.ts';

const ID = '0199f0a2-7c3e-7d4a-9b1e-2f3a4b5c6d7e';

describe('the simpler Pipelines contracts', () => {
  it('shows Environments and Platform to the Platform admin only', () => {
    expect(ROLE_PLACES.platform_admin).toContain('platform');
    expect(ROLE_PLACES.developer).not.toContain('environments');
    expect(ROLE_PLACES.approver).toEqual(['home', 'changes']);
  });

  it('starts a new environment with every optional setting off', () => {
    expect(createEnvironmentV2BodySchema.parse({ name: 'Dev', key: 'dev' })).toEqual({
      name: 'Dev',
      key: 'dev',
      deployers: null,
      approvalRule: null,
      window: null,
      versionsAllowed: 'any',
    });
  });

  it('refuses an order that names an environment twice', () => {
    expect(reorderEnvironmentsBodySchema.safeParse({ keys: ['dev', 'dev'] }).success).toBe(false);
  });

  it('reads change request numbers', () => {
    expect(changeRequestNumberSchema.safeParse('CHG-1042').success).toBe(true);
    expect(changeRequestNumberSchema.safeParse('CHG-0').success).toBe(false);
  });

  it('sends a change request as soon as approved unless told otherwise', () => {
    const body = createChangeRequestBodySchema.parse({
      environment: 'production',
      title: 'Offer retries',
      why: 'Fewer failed offers',
      risk: 'low',
      items: [{ application: 'buyer-agent', releaseId: ID }],
      picks: [{ step: 0, users: [ID] }],
    });
    expect(body.when).toEqual({ kind: 'asap' });
    expect(body.send).toBe(true);
  });

  it('adds no trigger to a pipeline nobody gave one', () => {
    const body = savePipelineSetupBodySchema.parse({
      start: 'empty',
      store: 'bemmoly',
      versionScheme: 'commit',
    });
    expect(body.triggers).toEqual([]);
    expect(savePipelineSetupBodySchema.safeParse({ ...body, start: 'template' }).success).toBe(
      false,
    );
  });
});
