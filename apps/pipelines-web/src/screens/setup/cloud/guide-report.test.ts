import type { CloudAccessCheckResponse } from '@bemmoly/module-pipelines/shared';
import { describe, expect, it } from 'vitest';
import { checkReport } from './guide-report.ts';
import { expectedPrincipal, guideSteps, type GuideInput } from './guide-steps.ts';
import { suggestionsOf, valuesOf } from './guide-values.ts';
import { readReach } from './reach-draft.ts';

const draft = {
  organizationId: '583920174411',
  billingAccountId: '01A2B3-C4D5E6-F7A8B9',
  you: 'keerthi@example.com',
  folderId: '417302018845',
};
const ACCOUNT = 'bemmoly-control@bemmoly-control-583920174411.iam.gserviceaccount.com';

function laptop(): GuideInput {
  const suggested = suggestionsOf({
    principal: null,
    signIn: 'application_default',
    firstProject: null,
    draft,
  });
  return {
    mode: 'managed',
    signIn: 'application_default',
    values: valuesOf(draft, suggested),
    reach: readReach({ kind: null, folder: '', projects: '' }),
  };
}

function report(response: Partial<CloudAccessCheckResponse>, guide = laptop()) {
  return checkReport({
    steps: guideSteps(guide),
    expected: expectedPrincipal(guide),
    folderId: guide.values.folderId,
    response: { signedIn: true, principal: ACCOUNT, problems: [], projects: [], ...response },
  });
}

const byKey = (result: ReturnType<typeof report>) =>
  Object.fromEntries(
    result.steps.map((step) => [step.key, [step.state, step.note, step.params['step']]]),
  );

describe('what Check says, step by step', () => {
  it('says bemmoly-control does not exist yet when Google Cloud cannot find it', () => {
    const result = report({
      signedIn: false,
      principal: null,
      problems: [
        'Bemmoly could not get a Google Cloud token. Google Cloud answered 404: Not found',
      ],
    });
    expect(byKey(result)['bootstrap']).toEqual(['failed', 'notCreated', 1]);
    expect(result.ready).toBe(false);
  });

  it('points at Token Creator when acting as the account is refused', () => {
    const result = report({
      signedIn: false,
      principal: null,
      problems: ['Permission iam.serviceAccounts.getAccessToken denied'],
    });
    expect(byKey(result)['tokenCreator']).toEqual(['failed', 'cannotAct', 2]);
  });

  it('says the sign-in is someone else when it is not acting as bemmoly-control', () => {
    const result = report({ principal: 'keerthi@example.com' });
    const signIn = result.steps.find((step) => step.key === 'signIn');
    expect(signIn).toMatchObject({ state: 'failed', note: 'actingAs' });
    expect(signIn?.params).toMatchObject({
      principal: 'keerthi@example.com',
      account: ACCOUNT,
      step: 3,
    });
  });

  it('sends missing folder grants back to the setup script, and is ready when none are', () => {
    const missing = report({
      problems: [`Grant ${ACCOUNT} Project Creator on folder 417302018845`],
    });
    expect(byKey(missing)['bootstrap']).toEqual(['failed', 'grantsMissing', 1]);
    expect(missing.ready).toBe(false);
    const unseen = report({
      problems: [`${ACCOUNT} cannot see folder 417302018845. Check the ID`],
    });
    expect(byKey(unseen)['folderId']?.slice(0, 2)).toEqual(['failed', 'folderUnseen']);
    const passed = report({});
    expect(passed.steps.every((step) => step.state === 'done')).toBe(true);
    expect(passed.ready).toBe(true);
  });

  it('lists blocked projects on the grant step and still lets an attached cloud connect', () => {
    const reach = readReach({ kind: 'projects', folder: '', projects: 'example-dev example-prod' });
    const principal = 'bemmoly@acme-tools.iam.gserviceaccount.com';
    const guide: GuideInput = {
      mode: 'attached',
      signIn: 'vm',
      reach,
      values: valuesOf(
        {},
        suggestionsOf({ principal, signIn: 'vm', firstProject: null, draft: {} }),
      ),
    };
    const project = {
      name: null,
      services: { run: true, build: true, secrets: true },
      problems: [],
    };
    const result = report(
      {
        principal,
        projects: [
          { ...project, externalId: 'example-dev', ok: true },
          { ...project, externalId: 'example-prod', ok: false },
        ],
      },
      guide,
    );
    expect(result.steps[0]).toMatchObject({ key: 'grant', state: 'failed', note: 'blocked' });
    expect(result.ready).toBe(true);
    expect(report({ principal, projects: [] }, guide).ready).toBe(false);
  });
});
