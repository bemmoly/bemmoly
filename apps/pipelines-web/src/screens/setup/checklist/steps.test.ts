import { describe, expect, it } from 'vitest';
import { isSetupPage, nextStep } from './steps.ts';

describe('the setup checklist', () => {
  it('raises the first step that can be done now', () => {
    expect(
      nextStep([
        { key: 'cloud', done: true, optional: false, blockedBy: null },
        { key: 'environments', done: false, optional: false, blockedBy: null },
      ]),
    ).toBe('environments');
    expect(
      nextStep([
        { key: 'cloud', done: false, optional: false, blockedBy: null },
        { key: 'environments', done: false, optional: false, blockedBy: 'cloud' },
      ]),
    ).toBe('cloud');
  });

  it('shows the way back on setup pages only', () => {
    expect(isSetupPage('/setup/cloud')).toBe(true);
    expect(isSetupPage('/services/checkout/pipelines')).toBe(true);
    expect(isSetupPage('/runs')).toBe(false);
    expect(isSetupPage('/')).toBe(false);
  });
});
