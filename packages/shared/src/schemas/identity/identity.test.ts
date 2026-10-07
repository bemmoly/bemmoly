import { describe, expect, it } from 'vitest';
import { createApiTokenSchema } from './api-tokens.ts';
import { loginRequestSchema, logoutRequestSchema } from './auth.ts';
import { PASSWORD_MIN_LENGTH, passwordSchema } from './common.ts';
import { createInvitationsSchema } from './invitations.ts';
import { createModuleGrantSchema } from './module-grants.ts';
import { createFirstAdminSchema } from './setup.ts';
import { updateUserSchema } from './users.ts';

const roleId = '01900000-0000-7000-8000-000000000001';

describe('identity schemas', () => {
  it('enforces the minimum password length on new passwords only', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12);
    expect(passwordSchema.safeParse('a'.repeat(11)).success).toBe(false);
    expect(passwordSchema.safeParse('a'.repeat(12)).success).toBe(true);
    expect(passwordSchema.safeParse('a'.repeat(1025)).success).toBe(false);
    expect(loginRequestSchema.safeParse({ email: 'a@b.test', password: 'short' }).success).toBe(
      true,
    );
  });

  it('normalises emails to trimmed lower case', () => {
    const parsed = createInvitationsSchema.parse({ emails: ['  Sam@Acme.DEV '], roleId });
    expect(parsed.emails).toEqual(['sam@acme.dev']);
    expect(createInvitationsSchema.safeParse({ emails: ['nope'], roleId }).success).toBe(false);
  });

  it('requires a subject id for every grant except everyone', () => {
    expect(
      createModuleGrantSchema.safeParse({ moduleId: 'work', subjectKind: 'everyone' }).success,
    ).toBe(true);
    expect(
      createModuleGrantSchema.safeParse({ moduleId: 'work', subjectKind: 'team' }).success,
    ).toBe(false);
    expect(
      createModuleGrantSchema.safeParse({
        moduleId: 'work',
        subjectKind: 'everyone',
        subjectId: roleId,
      }).success,
    ).toBe(false);
  });

  it('accepts only http(s) workspace URLs in setup', () => {
    const base = { workspaceName: 'Acme', name: 'R', email: 'r@a.test', password: 'p'.repeat(12) };
    expect(
      createFirstAdminSchema.safeParse({ ...base, workspaceUrl: 'https://a.test' }).success,
    ).toBe(true);
    expect(
      createFirstAdminSchema.safeParse({ ...base, workspaceUrl: 'javascript:alert(1)' }).success,
    ).toBe(false);
  });

  it('rejects empty patches and unknown token scopes, and defaults logout to this session', () => {
    expect(updateUserSchema.safeParse({}).success).toBe(false);
    expect(createApiTokenSchema.safeParse({ name: 'x', scopes: ['admin'] }).success).toBe(false);
    expect(logoutRequestSchema.parse(undefined)).toEqual({ everywhere: false });
  });
});
