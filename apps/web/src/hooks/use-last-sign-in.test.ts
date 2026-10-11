import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  forgetSignIn,
  LAST_SIGN_IN_KEY,
  readLastSignIn,
  rememberPerson,
  rememberSignIn,
  useLastSignIn,
} from './use-last-sign-in.ts';
import { setupLeft } from './use-setup-left.ts';

beforeEach(() => forgetSignIn());

describe('the remembered sign-in', () => {
  it('stays in this browser and is forgotten on request', () => {
    const { result } = renderHook(() => useLastSignIn());
    expect(result.current.last).toBeNull();
    act(() => rememberSignIn({ method: 'sso', providerId: 'okta', email: null, name: null }));
    expect(result.current.last).toEqual({
      method: 'sso',
      providerId: 'okta',
      email: null,
      name: null,
    });
    act(() => rememberPerson({ email: 'rohan@acmelabs.dev', name: 'Rohan S.' }));
    expect(result.current.last?.email).toBe('rohan@acmelabs.dev');
    expect(result.current.last?.method).toBe('sso');
    act(() => result.current.forget());
    expect(result.current.last).toBeNull();
    expect(localStorage.getItem(LAST_SIGN_IN_KEY)).toBeNull();
  });

  it('ignores anything it did not write', () => {
    localStorage.setItem(LAST_SIGN_IN_KEY, '{"method":"magic"}');
    expect(readLastSignIn()).toBeNull();
    localStorage.setItem(LAST_SIGN_IN_KEY, 'not json');
    expect(readLastSignIn()).toBeNull();
  });

  it('does not invent a person to remember', () => {
    rememberPerson({ email: 'rohan@acmelabs.dev', name: 'Rohan S.' });
    expect(readLastSignIn()).toBeNull();
  });
});

describe('setupLeft', () => {
  it('marks the workspace and account done, the step to resume next, and skips', () => {
    expect(setupLeft(null, []).map((step) => step.state)).toEqual([
      'done',
      'done',
      'next',
      'todo',
      'todo',
      'todo',
    ]);
    expect(setupLeft(5, [3]).map((step) => step.state)).toEqual([
      'done',
      'done',
      'skipped',
      'done',
      'next',
      'todo',
    ]);
  });
});
